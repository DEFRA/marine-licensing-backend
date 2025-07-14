import { GeoParser } from './geo-parser.js'
import { Worker } from 'worker_threads'
import { blobService } from '../blob-service.js'
import Boom from '@hapi/boom'
import { join } from 'path'

jest.mock('worker_threads', () => ({
  Worker: jest.fn()
}))

jest.mock('../blob-service.js', () => ({
  blobService: {
    createTempDirectory: jest.fn(),
    validateFileSize: jest.fn(),
    downloadFile: jest.fn(),
    cleanupTempDirectory: jest.fn()
  }
}))

jest.mock('../../common/helpers/logging/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }))
}))

jest.mock('path', () => ({
  join: jest.fn()
}))

describe('GeoParser', () => {
  let geoParser
  let mockWorker

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock setImmediate to execute synchronously
    global.setImmediate = jest.fn((cb) => cb())

    mockWorker = {
      on: jest.fn(),
      terminate: jest.fn()
    }
    Worker.mockReturnValue(mockWorker)

    // Mock path.join
    join.mockReturnValue('/tmp/test-dir/file_123')

    geoParser = new GeoParser()
  })

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const parser = new GeoParser()

      expect(parser.processingTimeout).toBe(30_000)
      expect(parser.memoryLimit).toBe(524_288_000)
    })
  })

  describe('extract', () => {
    const s3Bucket = 'test-bucket'
    const s3Key = 'test-key.kml'
    const fileType = 'kml'
    const tempDir = '/tmp/test-dir'
    const tempFilePath = '/tmp/test-dir/file_123'

    const mockGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-0.1, 51.5]
          },
          properties: {}
        }
      ]
    }

    beforeEach(() => {
      blobService.createTempDirectory.mockResolvedValue(tempDir)
      blobService.validateFileSize.mockResolvedValue({ size: 1024 })
      blobService.downloadFile.mockResolvedValue(tempFilePath)
      blobService.cleanupTempDirectory.mockResolvedValue()

      jest.spyOn(geoParser, 'parseFile').mockResolvedValue(mockGeoJSON)
      jest.spyOn(geoParser, 'validateGeoJSON').mockReturnValue(true)
    })

    it('should successfully extract GeoJSON from KML file', async () => {
      const result = await geoParser.extract(s3Bucket, s3Key, fileType)

      expect(result).toEqual(mockGeoJSON)
      expect(blobService.createTempDirectory).toHaveBeenCalled()
      expect(blobService.validateFileSize).toHaveBeenCalledWith(s3Bucket, s3Key)
      expect(blobService.downloadFile).toHaveBeenCalledWith(
        s3Bucket,
        s3Key,
        tempFilePath
      )
      expect(geoParser.parseFile).toHaveBeenCalledWith(tempFilePath, fileType)
      expect(geoParser.validateGeoJSON).toHaveBeenCalledWith(mockGeoJSON)
    })

    it('should successfully extract GeoJSON from shapefile', async () => {
      const shapefileType = 'shapefile'

      const result = await geoParser.extract(s3Bucket, s3Key, shapefileType)

      expect(result).toEqual(mockGeoJSON)
      expect(geoParser.parseFile).toHaveBeenCalledWith(
        tempFilePath,
        shapefileType
      )
    })

    it('should cleanup temp directory after successful processing', async () => {
      await geoParser.extract(s3Bucket, s3Key, fileType)

      expect(blobService.cleanupTempDirectory).toHaveBeenCalledWith(tempDir)
    })

    it('should cleanup temp directory after failed processing', async () => {
      geoParser.parseFile.mockRejectedValue(new Error('Parse failed'))

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow()

      expect(blobService.cleanupTempDirectory).toHaveBeenCalledWith(tempDir)
    })

    it('should handle createTempDirectory failures', async () => {
      const error = new Error('Permission denied')
      blobService.createTempDirectory.mockRejectedValue(error)

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(
        Boom.internal('GeoJSON extraction failed: Permission denied')
      )
    })

    it('should handle validateFileSize failures', async () => {
      const error = Boom.entityTooLarge('File too large')
      blobService.validateFileSize.mockRejectedValue(error)

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(error)
    })

    it('should handle downloadFile failures', async () => {
      const error = Boom.notFound('File not found')
      blobService.downloadFile.mockRejectedValue(error)

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(error)
    })

    it('should handle parseFile failures', async () => {
      const error = new Error('Parse failed')
      geoParser.parseFile.mockRejectedValue(error)

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(
        Boom.internal('GeoJSON extraction failed: Parse failed')
      )
    })

    it('should handle validateGeoJSON failures', async () => {
      const error = Boom.internal('Invalid GeoJSON')
      geoParser.validateGeoJSON.mockImplementation(() => {
        throw error
      })

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(error)
    })

    it('should not cleanup temp directory when creation fails', async () => {
      blobService.createTempDirectory.mockRejectedValue(
        new Error('Permission denied')
      )

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow()

      expect(blobService.cleanupTempDirectory).not.toHaveBeenCalled()
    })
  })

  describe('parseFile', () => {
    const filePath = '/tmp/test-file.kml'
    const fileType = 'kml'
    const mockGeoJSON = {
      type: 'FeatureCollection',
      features: []
    }

    beforeEach(() => {
      // Reset worker mock
      jest.clearAllMocks()
      mockWorker = {
        on: jest.fn(),
        terminate: jest.fn()
      }
      Worker.mockReturnValue(mockWorker)
    })

    it('should successfully parse file using worker thread', async () => {
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          // Simulate successful message
          setTimeout(() => callback({ geoJSON: mockGeoJSON }), 10)
        }
      })

      const result = await geoParser.parseFile(filePath, fileType)

      expect(result).toEqual(mockGeoJSON)
      expect(Worker).toHaveBeenCalledWith(
        './src/services/geo-parser/worker.js',
        {
          workerData: { filePath, fileType }
        }
      )
    })

    it('should handle worker error messages', async () => {
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => callback({ error: 'Parse failed' }), 10)
        }
      })

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        'Parse failed'
      )
    })

    it('should handle worker error event', async () => {
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Worker error')), 10)
        }
      })

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        Boom.internal('Worker error: Worker error')
      )
    })

    it('should handle worker exit with non-zero code', async () => {
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'exit') {
          // Worker exit event handler expects exit code (number) as first parameter
          // eslint-disable-next-line n/no-callback-literal
          setTimeout(() => callback(1), 10)
        }
      })

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        Boom.internal('Worker stopped with exit code 1')
      )
    })

    it('should handle worker exit with exit code 0', async () => {
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'exit') {
          // Worker exit event handler expects exit code (number) as first parameter
          // eslint-disable-next-line n/no-callback-literal
          setTimeout(() => callback(0), 10)
        }
      })

      geoParser.parseFile(filePath, fileType)

      // This test just ensures no error is thrown for exit code 0
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should timeout after processing timeout', async () => {
      mockWorker.on.mockImplementation(() => {
        // Worker never responds
      })

      // Override timeout for faster test
      geoParser.processingTimeout = 100

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        Boom.clientTimeout('Processing timeout exceeded')
      )

      expect(mockWorker.terminate).toHaveBeenCalled()
    })

    it('should clear timeout when worker responds', async () => {
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => callback({ geoJSON: mockGeoJSON }), 10)
        }
      })

      await geoParser.parseFile(filePath, fileType)

      expect(mockWorker.terminate).not.toHaveBeenCalled()
    })

    it('should clear timeout when worker has error', async () => {
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Worker error')), 10)
        }
      })

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow()

      expect(mockWorker.terminate).not.toHaveBeenCalled()
    })
  })

  describe('validateGeoJSON', () => {
    it('should validate valid FeatureCollection', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-0.1, 51.5]
            },
            properties: {}
          }
        ]
      }

      const result = geoParser.validateGeoJSON(geoJSON)

      expect(result).toBe(true)
    })

    it('should validate valid Feature', () => {
      const geoJSON = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-0.1, 51.5]
        },
        properties: {}
      }

      const result = geoParser.validateGeoJSON(geoJSON)

      expect(result).toBe(true)
    })

    it('should validate FeatureCollection with empty features', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: []
      }

      const result = geoParser.validateGeoJSON(geoJSON)

      expect(result).toBe(true)
    })

    it('should throw error for null GeoJSON', () => {
      const geoJSON = null

      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: not an object')
      )
    })

    it('should throw error for non-object GeoJSON', () => {
      const geoJSON = 'not an object'

      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: not an object')
      )
    })

    it('should throw error for missing type', () => {
      const geoJSON = {
        features: []
      }

      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: missing or invalid type')
      )
    })

    it('should throw error for invalid type', () => {
      const geoJSON = {
        type: 'InvalidType',
        features: []
      }

      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: missing or invalid type')
      )
    })

    it('should throw error for FeatureCollection with non-array features', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: 'not an array'
      }

      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: features must be an array')
      )
    })

    it('should throw error for FeatureCollection with missing features', () => {
      const geoJSON = {
        type: 'FeatureCollection'
      }

      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: features must be an array')
      )
    })

    it('should throw error when GeoJSON exceeds memory limit', () => {
      // Mock JSON.stringify to return a large size
      const originalStringify = JSON.stringify
      JSON.stringify = jest.fn(() => {
        // Return a string that simulates large size calculation
        return 'x'.repeat(1000) // Small actual string
      })

      // Mock Buffer.byteLength to return a size that exceeds the limit
      const originalByteLength = Buffer.byteLength
      Buffer.byteLength = jest.fn(() => 600000000) // 600MB > 500MB limit

      const geoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-0.1, 51.5]
            },
            properties: {}
          }
        ]
      }

      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        expect.objectContaining({
          isBoom: true,
          output: expect.objectContaining({
            statusCode: 413
          })
        })
      )

      // Restore original functions
      JSON.stringify = originalStringify
      Buffer.byteLength = originalByteLength
    })

    it('should handle small GeoJSON within memory limit', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-0.1, 51.5]
            },
            properties: {
              name: 'Test Point'
            }
          }
        ]
      }

      const result = geoParser.validateGeoJSON(geoJSON)

      expect(result).toBe(true)
    })
  })

  describe('Memory and performance limits', () => {
    it('should have correct default memory limit', () => {
      const parser = new GeoParser()

      expect(parser.memoryLimit).toBe(524_288_000) // 500MB in bytes
    })

    it('should have correct default processing timeout', () => {
      const parser = new GeoParser()

      expect(parser.processingTimeout).toBe(30_000) // 30 seconds in milliseconds
    })
  })
})
