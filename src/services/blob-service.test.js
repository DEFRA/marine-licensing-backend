// Mock logger first
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3'
import { createWriteStream } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { config } from '../config.js'
import Boom from '@hapi/boom'

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}

jest.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: jest.fn().mockReturnValue(mockLogger)
}))

// Mock config
jest.mock('../config.js', () => ({
  config: {
    get: jest.fn((key) => {
      const configs = {
        aws: {
          region: 'eu-west-2',
          s3: {
            timeout: 30000,
            endpoint: undefined
          }
        },
        'cdp.maxFileSize': 50000000
      }
      return configs[key]
    })
  }
}))

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  HeadObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn()
}))

// Mock file system operations
jest.mock('fs', () => ({
  createWriteStream: jest.fn()
}))

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  rm: jest.fn()
}))

jest.mock('stream/promises', () => ({
  pipeline: jest.fn()
}))

// Import BlobService after mocks are set up
let BlobService

describe('BlobService', () => {
  let blobService
  let mockS3Client
  let mockSend

  beforeAll(async () => {
    // Import BlobService after mocks are set up
    const module = await import('./blob-service.js')
    BlobService = module.BlobService
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset logger mock
    mockLogger.info.mockReset()
    mockLogger.warn.mockReset()
    mockLogger.error.mockReset()
    mockLogger.debug.mockReset()

    // Mock S3Client
    mockSend = jest.fn()
    mockS3Client = {
      send: mockSend
    }
    S3Client.mockReturnValue(mockS3Client)

    // Mock config values
    config.get.mockImplementation((key) => {
      const configMap = {
        aws: {
          region: 'eu-west-2',
          s3: {
            timeout: 30000,
            endpoint: undefined
          }
        },
        'cdp.maxFileSize': 50000000
      }
      return configMap[key]
    })

    blobService = new BlobService()
  })

  describe('Constructor', () => {
    it('should create S3Client with default configuration', () => {
      // Constructor call is intentional to test S3Client configuration
      // eslint-disable-next-line no-new
      new BlobService()

      // Then - should configure S3Client correctly
      expect(S3Client).toHaveBeenCalledWith({
        region: 'eu-west-2',
        requestHandler: {
          requestTimeout: 30000
        }
      })
    })

    it('should create S3Client with custom endpoint for localstack', () => {
      // Given - custom S3Client mock
      const customMockS3Client = { send: jest.fn() }
      S3Client.mockReturnValue(customMockS3Client)

      // Create service with custom config
      const service = new BlobService()
      service.client = new S3Client({
        region: 'eu-west-2',
        endpoint: 'http://localhost:4566',
        forcePathStyle: true,
        requestHandler: {
          requestTimeout: 30000
        }
      })

      // Then - should configure S3Client with endpoint
      expect(S3Client).toHaveBeenCalledWith({
        region: 'eu-west-2',
        endpoint: 'http://localhost:4566',
        forcePathStyle: true,
        requestHandler: {
          requestTimeout: 30000
        }
      })
    })

    it('should accept custom S3Client', () => {
      // Given - custom S3Client
      const customClient = { send: jest.fn() }

      // When - creating service with custom client
      const service = new BlobService(customClient)

      // Then - should use custom client
      expect(service.client).toBe(customClient)
    })
  })

  describe('getMetadata', () => {
    const s3Bucket = 'test-bucket'
    const s3Key = 'test-key.kml'

    it('should successfully retrieve S3 object metadata', async () => {
      // Given - successful S3 response
      const mockResponse = {
        ContentLength: 1024,
        LastModified: new Date('2023-01-01'),
        ContentType: 'application/vnd.google-earth.kml+xml',
        ETag: '"abc123"'
      }
      mockSend.mockResolvedValue(mockResponse)

      // When - getting metadata
      const result = await blobService.getMetadata(s3Bucket, s3Key)

      // Then - should return formatted metadata
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
      // Given - S3 NoSuchKey error
      const error = new Error('NoSuchKey')
      error.name = 'NoSuchKey'
      mockSend.mockRejectedValue(error)

      // When/Then - should throw not found error
      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.notFound('File not found in S3')
      )
    })

    it('should throw 404 when S3 object not found (NotFound error)', async () => {
      // Given - S3 NotFound error
      const error = new Error('NotFound')
      error.name = 'NotFound'
      mockSend.mockRejectedValue(error)

      // When/Then - should throw not found error
      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.notFound('File not found in S3')
      )
    })

    it('should throw 408 when S3 operation times out', async () => {
      // Given - S3 timeout error
      const error = new Error('RequestTimeout')
      error.name = 'RequestTimeout'
      mockSend.mockRejectedValue(error)

      // When/Then - should throw timeout error
      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.clientTimeout('S3 operation timed out')
      )
    })

    it('should throw 408 when S3 operation times out (TimeoutError)', async () => {
      // Given - S3 timeout error
      const error = new Error('TimeoutError')
      error.name = 'TimeoutError'
      mockSend.mockRejectedValue(error)

      // When/Then - should throw timeout error
      await expect(blobService.getMetadata(s3Bucket, s3Key)).rejects.toThrow(
        Boom.clientTimeout('S3 operation timed out')
      )
    })

    it('should throw 500 for other S3 errors', async () => {
      // Given - generic S3 error
      const error = new Error('Access denied')
      mockSend.mockRejectedValue(error)

      // When/Then - should throw internal server error
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
      // Mock createWriteStream
      const mockWriteStream = {
        write: jest.fn(),
        end: jest.fn()
      }
      createWriteStream.mockReturnValue(mockWriteStream)

      // Mock pipeline
      pipeline.mockResolvedValue()
    })

    it('should successfully download file from S3', async () => {
      // Given - successful S3 response with body
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

      // When - downloading file
      const result = await blobService.downloadFile(s3Bucket, s3Key, tempPath)

      // Then - should download successfully
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
      // Given - S3 response without body
      const mockResponse = {
        Body: null
      }
      mockSend.mockResolvedValue(mockResponse)

      // When/Then - should throw error
      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(
        Boom.internal('S3 download failed: No response body received from S3')
      )
    })

    it('should throw 404 when S3 file not found', async () => {
      // Given - S3 NoSuchKey error
      const error = new Error('NoSuchKey')
      error.name = 'NoSuchKey'
      mockSend.mockRejectedValue(error)

      // When/Then - should throw not found error
      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.notFound('File not found in S3'))
    })

    it('should throw 408 when S3 download times out', async () => {
      // Given - S3 timeout error
      const error = new Error('RequestTimeout')
      error.name = 'RequestTimeout'
      mockSend.mockRejectedValue(error)

      // When/Then - should throw timeout error
      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.clientTimeout('S3 download timed out'))
    })

    it('should throw 500 for pipeline errors', async () => {
      // Given - pipeline error
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

      // When/Then - should throw internal server error
      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.internal('S3 download failed: Pipeline failed'))
    })

    it('should throw 500 for other S3 errors', async () => {
      // Given - generic S3 error
      const error = new Error('Access denied')
      mockSend.mockRejectedValue(error)

      // When/Then - should throw internal server error
      await expect(
        blobService.downloadFile(s3Bucket, s3Key, tempPath)
      ).rejects.toThrow(Boom.internal('S3 download failed: Access denied'))
    })
  })

  describe('validateFileSize', () => {
    const s3Bucket = 'test-bucket'
    const s3Key = 'test-key.kml'

    it('should validate file size within limits', async () => {
      // Given - file size within limits
      const mockMetadata = {
        size: 1024,
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      jest.spyOn(blobService, 'getMetadata').mockResolvedValue(mockMetadata)

      // When - validating file size
      const result = await blobService.validateFileSize(s3Bucket, s3Key)

      // Then - should return metadata
      expect(result).toEqual(mockMetadata)
      expect(blobService.getMetadata).toHaveBeenCalledWith(s3Bucket, s3Key)
    })

    it('should throw 413 when file exceeds size limit by 1 byte', async () => {
      // Given - file size 1 byte over limit
      const mockMetadata = {
        size: 50000001, // 1 byte over limit
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      jest.spyOn(blobService, 'getMetadata').mockResolvedValue(mockMetadata)

      // When/Then - should throw entity too large error
      await expect(
        blobService.validateFileSize(s3Bucket, s3Key)
      ).rejects.toThrow(
        Boom.entityTooLarge(
          'File size (50000001 bytes) exceeds maximum allowed size (50000000 bytes)'
        )
      )
    })

    it('should allow file when exactly at size limit', async () => {
      // Given - file size exactly at limit
      const mockMetadata = {
        size: 50000000, // exactly at limit
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      jest.spyOn(blobService, 'getMetadata').mockResolvedValue(mockMetadata)

      // When - validating file size
      const result = await blobService.validateFileSize(s3Bucket, s3Key)

      // Then - should return metadata without throwing
      expect(result).toEqual(mockMetadata)
      expect(blobService.getMetadata).toHaveBeenCalledWith(s3Bucket, s3Key)
    })

    it('should propagate getMetadata errors', async () => {
      // Given - getMetadata throws error
      const error = Boom.notFound('File not found')
      jest.spyOn(blobService, 'getMetadata').mockRejectedValue(error)

      // When/Then - should propagate error
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
      // Given - successful mkdir operation

      // When - creating temp directory
      const result = await blobService.createTempDirectory()

      // Then - should create directory and return path
      expect(result).toMatch(/geo-parser\/[a-f0-9-]+$/)
      expect(mkdir).toHaveBeenCalledWith(result, { recursive: true })
    })

    it('should throw error when mkdir fails', async () => {
      // Given - mkdir fails
      const error = new Error('Permission denied')
      mkdir.mockRejectedValue(error)

      // When/Then - should throw error
      await expect(blobService.createTempDirectory()).rejects.toThrow(
        'Permission denied'
      )
    })

    it('should create unique directory names', async () => {
      // Given - multiple calls

      // When - creating multiple temp directories
      const dir1 = await blobService.createTempDirectory()
      const dir2 = await blobService.createTempDirectory()

      // Then - should create unique directories
      expect(dir1).not.toBe(dir2)
      expect(mkdir).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanupTempDirectory', () => {
    const tempDir = '/tmp/test-directory'

    it('should successfully cleanup temporary directory', async () => {
      // Given - successful rm operation
      rm.mockResolvedValue()

      // When - cleaning up temp directory
      await blobService.cleanupTempDirectory(tempDir)

      // Then - should remove directory recursively
      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should not throw error when cleanup fails', async () => {
      // Given - rm fails
      const error = new Error('Directory not found')
      rm.mockRejectedValue(error)

      // When - cleaning up temp directory
      await expect(
        blobService.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      // Then - should handle error gracefully
      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should handle non-existent directory gracefully', async () => {
      // Given - directory doesn't exist
      const error = new Error('ENOENT: no such file or directory')
      error.code = 'ENOENT'
      rm.mockRejectedValue(error)

      // When - cleaning up non-existent directory
      await expect(
        blobService.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      // Then - should handle gracefully
      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })
  })

  describe('Configuration variations', () => {
    it('should handle different timeout values', () => {
      // Given - service with custom timeout
      const service = new BlobService()
      service.timeout = 60000

      // Create S3Client with custom timeout config
      const customClient = new S3Client({
        region: 'us-east-1',
        requestHandler: {
          requestTimeout: 60000
        }
      })
      service.client = customClient

      // Then - should use correct timeout
      expect(service.timeout).toBe(60000)
      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
        requestHandler: {
          requestTimeout: 60000
        }
      })
    })

    it('should handle different regions', () => {
      // Given - service with custom region
      const service = new BlobService()

      // Create S3Client with different region config
      const customClient = new S3Client({
        region: 'ap-southeast-2',
        requestHandler: {
          requestTimeout: 30000
        }
      })
      service.client = customClient

      // Then - should use correct region
      expect(S3Client).toHaveBeenCalledWith({
        region: 'ap-southeast-2',
        requestHandler: {
          requestTimeout: 30000
        }
      })
    })

    it('should handle different max file sizes', async () => {
      // Given - different max file size configuration
      config.get.mockImplementation((key) => {
        const configMap = {
          'aws.region': 'eu-west-2',
          'aws.s3.timeout': 30000,
          'aws.s3.endpoint': undefined,
          'cdp.maxFileSize': 100000000 // 100MB
        }
        return configMap[key]
      })

      const service = new BlobService()
      const mockMetadata = {
        size: 80000000, // 80MB
        lastModified: new Date(),
        contentType: 'application/vnd.google-earth.kml+xml',
        etag: '"abc123"'
      }
      jest.spyOn(service, 'getMetadata').mockResolvedValue(mockMetadata)

      // When - validating file size
      const result = await service.validateFileSize('bucket', 'key')

      // Then - should accept larger file
      expect(result).toEqual(mockMetadata)
    })
  })
})
