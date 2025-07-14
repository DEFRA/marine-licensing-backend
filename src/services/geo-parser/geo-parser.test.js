import { GeoParser } from './geo-parser.js'
import { Worker } from 'worker_threads'
import { blobService } from '../blob-service.js'
import { kmlParser } from './kml-parser.js'
import { shapefileParser } from './shapefile-parser.js'
import Boom from '@hapi/boom'
import { join } from 'path'

// Mock worker threads
jest.mock('worker_threads', () => ({
  Worker: jest.fn()
}))

// Mock blob service
jest.mock('../blob-service.js', () => ({
  blobService: {
    createTempDirectory: jest.fn(),
    validateFileSize: jest.fn(),
    downloadFile: jest.fn(),
    cleanupTempDirectory: jest.fn()
  }
}))

// Mock parsers
jest.mock('./kml-parser.js', () => ({
  kmlParser: {
    parseFile: jest.fn()
  }
}))

jest.mock('./shapefile-parser.js', () => ({
  shapefileParser: {
    parseFile: jest.fn()
  }
}))

// Mock logger
jest.mock('../../common/helpers/logging/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }))
}))

// Mock path
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

    // Mock worker
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
      // Given - new GeoParser instance
      const parser = new GeoParser()

      // Then - should set default values
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

      // Mock successful parseFile
      jest.spyOn(geoParser, 'parseFile').mockResolvedValue(mockGeoJSON)
      jest.spyOn(geoParser, 'validateGeoJSON').mockReturnValue(true)
    })

    it('should successfully extract GeoJSON from KML file', async () => {
      // Given - successful file processing

      // When - extracting GeoJSON
      const result = await geoParser.extract(s3Bucket, s3Key, fileType)

      // Then - should return GeoJSON
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
      // Given - shapefile processing
      const shapefileType = 'shapefile'

      // When - extracting GeoJSON
      const result = await geoParser.extract(s3Bucket, s3Key, shapefileType)

      // Then - should return GeoJSON
      expect(result).toEqual(mockGeoJSON)
      expect(geoParser.parseFile).toHaveBeenCalledWith(
        tempFilePath,
        shapefileType
      )
    })

    it('should cleanup temp directory after successful processing', async () => {
      // Given - successful processing

      // When - extracting GeoJSON
      await geoParser.extract(s3Bucket, s3Key, fileType)

      // Then - should cleanup temp directory asynchronously
      expect(blobService.cleanupTempDirectory).toHaveBeenCalledWith(tempDir)
    })

    it('should cleanup temp directory after failed processing', async () => {
      // Given - failed processing
      geoParser.parseFile.mockRejectedValue(new Error('Parse failed'))

      // When - extracting GeoJSON
      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow()

      // Then - should cleanup temp directory
      expect(blobService.cleanupTempDirectory).toHaveBeenCalledWith(tempDir)
    })

    it('should handle createTempDirectory failures', async () => {
      // Given - temp directory creation fails
      const error = new Error('Permission denied')
      blobService.createTempDirectory.mockRejectedValue(error)

      // When/Then - should throw internal server error
      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(
        Boom.internal('GeoJSON extraction failed: Permission denied')
      )
    })

    it('should handle validateFileSize failures', async () => {
      // Given - file size validation fails
      const error = Boom.entityTooLarge('File too large')
      blobService.validateFileSize.mockRejectedValue(error)

      // When/Then - should propagate Boom error
      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(error)
    })

    it('should handle downloadFile failures', async () => {
      // Given - file download fails
      const error = Boom.notFound('File not found')
      blobService.downloadFile.mockRejectedValue(error)

      // When/Then - should propagate Boom error
      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(error)
    })

    it('should handle parseFile failures', async () => {
      // Given - file parsing fails
      const error = new Error('Parse failed')
      geoParser.parseFile.mockRejectedValue(error)

      // When/Then - should throw internal server error
      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(
        Boom.internal('GeoJSON extraction failed: Parse failed')
      )
    })

    it('should handle validateGeoJSON failures', async () => {
      // Given - GeoJSON validation fails
      const error = Boom.internal('Invalid GeoJSON')
      geoParser.validateGeoJSON.mockImplementation(() => {
        throw error
      })

      // When/Then - should propagate Boom error
      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(error)
    })

    it('should not cleanup temp directory when creation fails', async () => {
      // Given - temp directory creation fails
      blobService.createTempDirectory.mockRejectedValue(
        new Error('Permission denied')
      )

      // When - extracting GeoJSON
      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow()

      // Then - should not attempt cleanup
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
      // Given - worker returns success
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          // Simulate successful message
          setTimeout(() => callback({ geoJSON: mockGeoJSON }), 10)
        }
      })

      // When - parsing file
      const result = await geoParser.parseFile(filePath, fileType)

      // Then - should return GeoJSON
      expect(result).toEqual(mockGeoJSON)
      expect(Worker).toHaveBeenCalledWith(
        './src/services/geo-parser/worker.js',
        {
          workerData: { filePath, fileType }
        }
      )
    })

    it('should handle worker error messages', async () => {
      // Given - worker returns error message
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => callback({ error: 'Parse failed' }), 10)
        }
      })

      // When/Then - should throw error
      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        'Parse failed'
      )
    })

    it('should handle worker error event', async () => {
      // Given - worker emits error event
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Worker error')), 10)
        }
      })

      // When/Then - should throw internal server error
      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        Boom.internal('Worker error: Worker error')
      )
    })

    it('should handle worker exit with non-zero code', async () => {
      // Given - worker exits with error code
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'exit') {
          // Worker exit event handler expects exit code (number) as first parameter
          // eslint-disable-next-line n/no-callback-literal
          setTimeout(() => callback(1), 10)
        }
      })

      // When/Then - should throw internal server error
      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        Boom.internal('Worker stopped with exit code 1')
      )
    })

    it('should handle worker exit with exit code 0', async () => {
      // Given - worker exits with zero code but no message
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'exit') {
          // Worker exit event handler expects exit code (number) as first parameter
          // eslint-disable-next-line n/no-callback-literal
          setTimeout(() => callback(0), 10)
        }
      })

      // When - parsing file
      geoParser.parseFile(filePath, fileType)

      // Then - should not throw error for zero exit code
      // This test just ensures no error is thrown for exit code 0
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('should timeout after processing timeout', async () => {
      // Given - worker never responds
      mockWorker.on.mockImplementation(() => {
        // Worker never responds
      })

      // Override timeout for faster test
      geoParser.processingTimeout = 100

      // When/Then - should throw timeout error
      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        Boom.clientTimeout('Processing timeout exceeded')
      )

      expect(mockWorker.terminate).toHaveBeenCalled()
    })

    it('should clear timeout when worker responds', async () => {
      // Given - worker responds quickly
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => callback({ geoJSON: mockGeoJSON }), 10)
        }
      })

      // When - parsing file
      await geoParser.parseFile(filePath, fileType)

      // Then - should not timeout
      expect(mockWorker.terminate).not.toHaveBeenCalled()
    })

    it('should clear timeout when worker has error', async () => {
      // Given - worker has error
      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Worker error')), 10)
        }
      })

      // When - parsing file
      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow()

      // Then - should not timeout
      expect(mockWorker.terminate).not.toHaveBeenCalled()
    })
  })

  describe('parseFileDirectly', () => {
    const filePath = '/tmp/test-file.kml'
    const mockGeoJSON = {
      type: 'FeatureCollection',
      features: []
    }

    beforeEach(() => {
      kmlParser.parseFile.mockResolvedValue(mockGeoJSON)
      shapefileParser.parseFile.mockResolvedValue(mockGeoJSON)
    })

    it('should parse KML file directly', async () => {
      // Given - KML file type
      const fileType = 'kml'

      // When - parsing file directly
      const result = await geoParser.parseFileDirectly(filePath, fileType)

      // Then - should use KML parser
      expect(result).toEqual(mockGeoJSON)
      expect(kmlParser.parseFile).toHaveBeenCalledWith(filePath)
      expect(shapefileParser.parseFile).not.toHaveBeenCalled()
    })

    it('should parse shapefile directly', async () => {
      // Given - shapefile type
      const fileType = 'shapefile'

      // When - parsing file directly
      const result = await geoParser.parseFileDirectly(filePath, fileType)

      // Then - should use shapefile parser
      expect(result).toEqual(mockGeoJSON)
      expect(shapefileParser.parseFile).toHaveBeenCalledWith(filePath)
      expect(kmlParser.parseFile).not.toHaveBeenCalled()
    })

    it('should throw error for unsupported file type', async () => {
      // Given - unsupported file type
      const fileType = 'unsupported'

      // When/Then - should throw bad request error
      await expect(
        geoParser.parseFileDirectly(filePath, fileType)
      ).rejects.toThrow(Boom.badRequest('Unsupported file type: unsupported'))
    })

    it('should handle KML parser errors', async () => {
      // Given - KML parser throws error
      const error = new Error('Parse failed')
      kmlParser.parseFile.mockRejectedValue(error)

      // When/Then - should throw internal server error
      await expect(
        geoParser.parseFileDirectly(filePath, 'kml')
      ).rejects.toThrow(Boom.internal('File parsing failed: Parse failed'))
    })

    it('should handle shapefile parser errors', async () => {
      // Given - shapefile parser throws error
      const error = new Error('Parse failed')
      shapefileParser.parseFile.mockRejectedValue(error)

      // When/Then - should throw internal server error
      await expect(
        geoParser.parseFileDirectly(filePath, 'shapefile')
      ).rejects.toThrow(Boom.internal('File parsing failed: Parse failed'))
    })

    it('should propagate Boom errors from parsers', async () => {
      // Given - parser throws Boom error
      const error = Boom.badRequest('Invalid KML')
      kmlParser.parseFile.mockRejectedValue(error)

      // When/Then - should propagate Boom error
      await expect(
        geoParser.parseFileDirectly(filePath, 'kml')
      ).rejects.toThrow(error)
    })
  })

  describe('validateGeoJSON', () => {
    it('should validate valid FeatureCollection', () => {
      // Given - valid FeatureCollection
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

      // When - validating GeoJSON
      const result = geoParser.validateGeoJSON(geoJSON)

      // Then - should return true
      expect(result).toBe(true)
    })

    it('should validate valid Feature', () => {
      // Given - valid Feature
      const geoJSON = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-0.1, 51.5]
        },
        properties: {}
      }

      // When - validating GeoJSON
      const result = geoParser.validateGeoJSON(geoJSON)

      // Then - should return true
      expect(result).toBe(true)
    })

    it('should validate FeatureCollection with empty features', () => {
      // Given - FeatureCollection with empty features
      const geoJSON = {
        type: 'FeatureCollection',
        features: []
      }

      // When - validating GeoJSON
      const result = geoParser.validateGeoJSON(geoJSON)

      // Then - should return true
      expect(result).toBe(true)
    })

    it('should throw error for null GeoJSON', () => {
      // Given - null GeoJSON
      const geoJSON = null

      // When/Then - should throw error
      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: not an object')
      )
    })

    it('should throw error for non-object GeoJSON', () => {
      // Given - non-object GeoJSON
      const geoJSON = 'not an object'

      // When/Then - should throw error
      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: not an object')
      )
    })

    it('should throw error for missing type', () => {
      // Given - GeoJSON without type
      const geoJSON = {
        features: []
      }

      // When/Then - should throw error
      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: missing or invalid type')
      )
    })

    it('should throw error for invalid type', () => {
      // Given - GeoJSON with invalid type
      const geoJSON = {
        type: 'InvalidType',
        features: []
      }

      // When/Then - should throw error
      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: missing or invalid type')
      )
    })

    it('should throw error for FeatureCollection with non-array features', () => {
      // Given - FeatureCollection with non-array features
      const geoJSON = {
        type: 'FeatureCollection',
        features: 'not an array'
      }

      // When/Then - should throw error
      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: features must be an array')
      )
    })

    it('should throw error for FeatureCollection with missing features', () => {
      // Given - FeatureCollection without features
      const geoJSON = {
        type: 'FeatureCollection'
      }

      // When/Then - should throw error
      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        Boom.internal('Invalid GeoJSON: features must be an array')
      )
    })

    it('should throw error when GeoJSON exceeds memory limit', () => {
      // Given - mock JSON.stringify to return a large size
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

      // When/Then - should throw entity too large error
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
      // Given - small GeoJSON within memory limit
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

      // When - validating GeoJSON
      const result = geoParser.validateGeoJSON(geoJSON)

      // Then - should return true
      expect(result).toBe(true)
    })
  })

  describe('Memory and performance limits', () => {
    it('should have correct default memory limit', () => {
      // Given - new GeoParser instance
      const parser = new GeoParser()

      // Then - should have 500MB memory limit
      expect(parser.memoryLimit).toBe(524_288_000) // 500MB in bytes
    })

    it('should have correct default processing timeout', () => {
      // Given - new GeoParser instance
      const parser = new GeoParser()

      // Then - should have 30 second timeout
      expect(parser.processingTimeout).toBe(30_000) // 30 seconds in milliseconds
    })
  })
})
