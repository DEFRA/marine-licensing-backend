import { vi } from 'vitest'
import { HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { config } from '../config.js'
import Boom from '@hapi/boom'

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}

vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue(mockLogger),
  structureErrorForECS: vi.fn((error) => ({
    error: {
      message: error?.message || String(error),
      stack_trace: error?.stack,
      type: error?.name || error?.constructor?.name || 'Error',
      code: error?.code || error?.statusCode
    }
  }))
}))

vi.mock('../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const configs = {
        aws: {
          region: 'eu-west-2',
          s3: {
            timeout: 30_000,
            endpoint: undefined
          }
        },
        cdpEnvironment: 'test',
        'cdp.maxFileSize': 50_000_000
      }
      return configs[key]
    })
  },
  isDevelopment: false
}))

vi.mock('./data-service/s3-client.js', () => ({
  getS3Client: vi.fn()
}))

vi.mock('@aws-sdk/client-s3', () => ({
  HeadObjectCommand: vi.fn(function () {}),
  GetObjectCommand: vi.fn(function () {})
}))

vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(function () {})
}))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(function () {}),
  rm: vi.fn(function () {})
}))

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(function () {})
}))

let BlobService
let getS3Client

describe('BlobService', () => {
  let blobService
  let mockS3Client
  let mockSend

  beforeAll(async () => {
    // Import BlobService _after_ mocks are set up
    const module = await import('./blob-service.js')
    BlobService = module.BlobService

    const s3ClientModule = await import('./data-service/s3-client.js')
    getS3Client = s3ClientModule.getS3Client
  })

  beforeEach(() => {
    mockLogger.info.mockReset()
    mockLogger.warn.mockReset()
    mockLogger.error.mockReset()
    mockLogger.debug.mockReset()

    mockSend = vi.fn()
    mockS3Client = {
      send: mockSend
    }

    getS3Client.mockReturnValue(mockS3Client)

    config.get.mockImplementation((key) => {
      const configMap = {
        aws: {
          region: 'eu-west-2',
          s3: {
            timeout: 30_000,
            endpoint: undefined
          }
        },
        cdpEnvironment: 'test',
        'cdp.maxFileSize': 50_000_000
      }
      return configMap[key]
    })

    blobService = new BlobService()
  })

  describe('Constructor', () => {
    it('should use getS3Client singleton by default', () => {
      // eslint-disable-next-line no-new
      new BlobService()

      expect(getS3Client).toHaveBeenCalled()
    })

    it('should accept custom S3Client and not call getS3Client', () => {
      const customClient = { send: vi.fn() }
      getS3Client.mockClear()

      const service = new BlobService(customClient)

      expect(service.client).toBe(customClient)
      expect(getS3Client).not.toHaveBeenCalled()
    })

    it('should set timeout from config', () => {
      const service = new BlobService()

      expect(service.timeout).toBe(30_000)
    })
  })

  describe('getMetadata', () => {
    const s3Bucket = 'test-bucket'
    const s3Key = 'test-key.kml'

    it('should successfully retrieve S3 object metadata', async () => {
      const mockResponse = {
        ContentLength: 1024,
        LastModified: new Date('2023-01-01'),
        ContentType: 'application/vnd.google-earth.kml+xml',
        ETag: '"abc123"'
      }
      mockSend.mockResolvedValue(mockResponse)

      const result = await blobService.getMetadata(s3Bucket, s3Key)

      expect(result).toEqual({
        size: 1024,
        lastModified: mockResponse.LastModified,
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      })
      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadObjectCommand))
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: s3Bucket,
        Key: s3Key
      })
    })

    it('should throw 404 when S3 object not found', async () => {
      const error = new Error('NoSuchKey')
      error.name = 'NoSuchKey'
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.notFound('File not found in S3')
      )
    })

    it('should throw 404 when S3 object not found (NotFound error)', async () => {
      const error = new Error('NotFound')
      error.name = 'NotFound'
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.notFound('File not found in S3')
      )
    })

    it('should throw 408 when S3 operation times out', async () => {
      const error = new Error('RequestTimeout')
      error.name = 'RequestTimeout'
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.clientTimeout('S3 operation timed out')
      )
    })

    it('should throw 408 when S3 operation times out (TimeoutError)', async () => {
      const error = new Error('TimeoutError')
      error.name = 'TimeoutError'
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.clientTimeout('S3 operation timed out')
      )
    })

    it('should throw 500 for other S3 errors', async () => {
      const error = new Error('Access denied')
      mockSend.mockRejectedValue(error)

      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.internal('S3 metadata retrieval failed: Access denied')
      )
    })
  })

  describe('downloadFile', () => {
    const s3Bucket = 'test-bucket'
    const s3Key = 'test-key.kml'
    const tempPath = '/tmp/test-file'

    beforeEach(() => {
      const mockWriteStream = {
        write: vi.fn(),
        end: vi.fn()
      }
      createWriteStream.mockReturnValue(mockWriteStream)

      pipeline.mockResolvedValue()
    })

    it('should successfully download file from S3', async () => {
      const mockBody = new Readable({
        read() {
          this.push('test content')
          this.push(null)
        }
      })
      const mockResponse = {
        Body: mockBody
      }
      mockSend.mockResolvedValue(mockResponse)

      const result = await blobService.downloadFile(s3Bucket, s3Key, tempPath)

      expect(result).toBe(tempPath)
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetObjectCommand))
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: s3Bucket,
        Key: s3Key
      })
      expect(createWriteStream).toHaveBeenCalledWith(tempPath)
      expect(pipeline).toHaveBeenCalled()
    })

    it('should throw error when S3 response has no body', async () => {
      const mockResponse = {
        Body: null
      }
      mockSend.mockResolvedValue(mockResponse)

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(
        Boom.internal('S3 download failed: No response body received from S3')
      )
    })

    it('should throw 404 when S3 file not found', async () => {
      const error = new Error('NoSuchKey')
      error.name = 'NoSuchKey'
      mockSend.mockRejectedValue(error)

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.notFound('File not found in S3'))
    })

    it('should throw 408 when S3 download times out', async () => {
      const error = new Error('RequestTimeout')
      error.name = 'RequestTimeout'
      mockSend.mockRejectedValue(error)

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.clientTimeout('S3 download timed out'))
    })

    it('should throw 500 for pipeline errors', async () => {
      const mockBody = new Readable({
        read() {
          this.push('test content')
          this.push(null)
        }
      })
      const mockResponse = {
        Body: mockBody
      }
      mockSend.mockResolvedValue(mockResponse)
      pipeline.mockRejectedValue(new Error('Pipeline failed'))

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.internal('S3 download failed: Pipeline failed'))
    })

    it('should throw 500 for other S3 errors', async () => {
      const error = new Error('Access denied')
      mockSend.mockRejectedValue(error)

      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.internal('S3 download failed: Access denied'))
    })
  })

  describe('validateFileSize', () => {
    const s3Bucket = 'test-bucket'
    const s3Key = 'test-key.kml'

    it('should validate file size within limits', async () => {
      const mockMetadata = {
        size: 1024,
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      vi.spyOn(blobService, 'getMetadata').mockResolvedValue(mockMetadata)

      const result = await blobService.validateFileSize(s3Bucket, s3Key)

      expect(result).toEqual(mockMetadata)
      expect(blobService.getMetadata).toHaveBeenCalledWith(s3Bucket, s3Key)
    })

    it('should throw 413 when file exceeds size limit by 1 byte', async () => {
      const mockMetadata = {
        size: 50_000_001, // 1 byte over limit
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      vi.spyOn(blobService, 'getMetadata').mockResolvedValue(mockMetadata)

      await expect(
        blobService.validateFileSize(s3Bucket, s3Key)
      ).rejects.toThrow(
        Boom.entityTooLarge(
          'File size (50000001 bytes) exceeds maximum allowed size (50000000 bytes)'
        )
      )
    })

    it('should allow file when exactly at size limit', async () => {
      const mockMetadata = {
        size: 50_000_000, // exactly at limit
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      vi.spyOn(blobService, 'getMetadata').mockResolvedValue(mockMetadata)

      const result = await blobService.validateFileSize(s3Bucket, s3Key)

      // Should return metadata without throwing
      expect(result).toEqual(mockMetadata)
      expect(blobService.getMetadata).toHaveBeenCalledWith(s3Bucket, s3Key)
    })

    it('should propagate getMetadata errors', async () => {
      const error = Boom.notFound('File not found')
      vi.spyOn(blobService, 'getMetadata').mockRejectedValue(error)

      await expect(
        blobService.validateFileSize(s3Bucket, s3Key)
      ).rejects.toThrow(error)
    })
  })

  describe('createTempDirectory', () => {
    beforeEach(() => {
      mkdir.mockResolvedValue()
    })

    it('should create temporary directory', async () => {
      const result = await blobService.createTempDirectory()

      expect(result).toMatch(/geo-parser\/[a-f0-9-]+$/)
      expect(mkdir).toHaveBeenCalledWith(result, { recursive: true })
    })

    it('should throw error when mkdir fails', async () => {
      const error = new Error('Permission denied')
      mkdir.mockRejectedValue(error)

      await expect(blobService.createTempDirectory()).rejects.toThrow(
        'Permission denied'
      )
    })

    it('should create unique directory names', async () => {
      const dir1 = await blobService.createTempDirectory()
      const dir2 = await blobService.createTempDirectory()

      expect(dir1).not.toBe(dir2)
      expect(mkdir).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanupTempDirectory', () => {
    const tempDir = '/tmp/test-directory'

    it('should successfully cleanup temporary directory', async () => {
      rm.mockResolvedValue()

      await blobService.cleanupTempDirectory(tempDir)

      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should not throw error when cleanup fails', async () => {
      const error = new Error('Directory not found')
      rm.mockRejectedValue(error)

      await expect(
        blobService.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should handle non-existent directory gracefully', async () => {
      const error = new Error('ENOENT: no such file or directory')
      error.code = 'ENOENT'
      rm.mockRejectedValue(error)

      await expect(
        blobService.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })
  })

  describe('Configuration variations', () => {
    it('should handle different max file sizes', async () => {
      config.get.mockImplementation((key) => {
        const configMap = {
          aws: {
            region: 'eu-west-2',
            s3: {
              timeout: 30_000,
              endpoint: undefined
            }
          },
          cdpEnvironment: 'test',
          'cdp.maxFileSize': 100_000_000 // 100MB
        }
        return configMap[key]
      })

      const service = new BlobService()
      const mockMetadata = {
        size: 80_000_000, // 80MB
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      vi.spyOn(service, 'getMetadata').mockResolvedValue(mockMetadata)

      const result = await service.validateFileSize('bucket', 'key')

      expect(result).toEqual(mockMetadata)
    })
  })
})
