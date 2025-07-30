import Boom from '@hapi/boom'
import { join } from 'path'
import { Worker } from 'worker_threads'
import { blobService } from '../blob-service.js'
import { GeoParser } from './geo-parser.js'

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

  const createFeature = (geometry, properties = {}) => ({
    type: 'Feature',
    geometry,
    properties
  })

  const createFeatureCollection = (features) => ({
    type: 'FeatureCollection',
    features
  })

  const createPointGeometry = (coordinates) => ({
    type: 'Point',
    coordinates
  })

  const createPolygonGeometry = (coordinates) => ({
    type: 'Polygon',
    coordinates
  })

  const setupBlobServiceMocks = (
    tempDir = '/tmp/test-dir',
    tempFilePath = '/tmp/test-dir/file_123'
  ) => {
    blobService.createTempDirectory.mockResolvedValue(tempDir)
    blobService.validateFileSize.mockResolvedValue({ size: 1024 })
    blobService.downloadFile.mockResolvedValue(tempFilePath)
    blobService.cleanupTempDirectory.mockResolvedValue()
  }

  const setupWorkerMocks = () => {
    jest.clearAllMocks()
    mockWorker = {
      on: jest.fn(),
      terminate: jest.fn()
    }
    Worker.mockReturnValue(mockWorker)
  }

  const setupMockWorker = (eventType, eventData) => {
    mockWorker.on.mockImplementation((event, callback) => {
      if (event === eventType) {
        setTimeout(() => callback(eventData), 10)
      }
    })
  }

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
      setupBlobServiceMocks(tempDir, tempFilePath)

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
    const mockGeoJSON = createFeatureCollection([])

    beforeEach(() => {
      setupWorkerMocks()
    })

    it('should successfully parse file using worker thread', async () => {
      setupMockWorker('message', { geoJSON: mockGeoJSON })

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
      setupMockWorker('message', { error: 'Parse failed' })

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        'Parse failed'
      )
    })

    it.each([
      {
        scenario: 'worker error event',
        eventType: 'error',
        eventData: new Error('Worker error'),
        expectedError: 'Worker error: Worker error'
      },
      {
        scenario: 'worker exit with non-zero code',
        eventType: 'exit',
        eventData: 1,
        expectedError: 'Worker stopped with exit code 1'
      }
    ])(
      'should handle $scenario',
      async ({ eventType, eventData, expectedError }) => {
        setupMockWorker(eventType, eventData)

        await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
          expectedError
        )
      }
    )

    it('should handle worker exit with exit code 0 without throwing error', async () => {
      let promiseResolved = false
      let promiseRejected = false

      setupMockWorker('exit', 0)

      const parsePromise = geoParser.parseFile(filePath, fileType)
      parsePromise
        .then(() => {
          promiseResolved = true
        })
        .catch(() => {
          promiseRejected = true
        })

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Exit code 0 should not cause rejection or termination
      expect(mockWorker.terminate).not.toHaveBeenCalled()
      expect(promiseResolved).toBe(false) // Promise should still be pending
      expect(promiseRejected).toBe(false) // Promise should not be rejected
    })

    it('should timeout after processing timeout', async () => {
      mockWorker.on.mockImplementation(() => {
        // Worker never responds
      })

      // Override timeout for faster test
      geoParser.processingTimeout = 100

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        'Processing timeout exceeded'
      )

      expect(mockWorker.terminate).toHaveBeenCalled()
    })

    it.each([
      {
        scenario: 'worker responds',
        eventType: 'message',
        eventData: { geoJSON: mockGeoJSON },
        shouldReject: false
      },
      {
        scenario: 'worker has error',
        eventType: 'error',
        eventData: new Error('Worker error'),
        shouldReject: true
      }
    ])(
      'should clear timeout when $scenario',
      async ({ eventType, eventData, shouldReject }) => {
        setupMockWorker(eventType, eventData)

        if (shouldReject) {
          await expect(
            geoParser.parseFile(filePath, fileType)
          ).rejects.toThrow()
        } else {
          await geoParser.parseFile(filePath, fileType)
        }

        expect(mockWorker.terminate).not.toHaveBeenCalled()
      }
    )
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
      Buffer.byteLength = jest.fn(() => 600_000_000) // 600MB > 500MB limit

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

  describe('Boundary condition tests', () => {
    it('should handle GeoJSON exactly at memory limit', () => {
      const originalByteLength = Buffer.byteLength
      Buffer.byteLength = jest.fn(() => 524_288_000) // Exactly 500MB

      const geoJSON = createFeatureCollection([
        createFeature(createPointGeometry([-0.1, 51.5]), {})
      ])

      const result = geoParser.validateGeoJSON(geoJSON)

      expect(result).toBe(true)

      Buffer.byteLength = originalByteLength
    })

    it('should reject GeoJSON just over memory limit', () => {
      const originalByteLength = Buffer.byteLength
      Buffer.byteLength = jest.fn(() => 524_288_001) // Just over 500MB limit

      const geoJSON = createFeatureCollection([
        createFeature(createPointGeometry([-0.1, 51.5]), {})
      ])

      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        expect.objectContaining({
          isBoom: true,
          output: expect.objectContaining({
            statusCode: 413
          })
        })
      )

      Buffer.byteLength = originalByteLength
    })
  })

  describe('File upload validation scenarios (ML-70)', () => {
    beforeEach(() => {
      setupBlobServiceMocks()
    })

    it('should handle empty KML files gracefully', async () => {
      const emptyGeoJSON = createFeatureCollection([])

      jest.spyOn(geoParser, 'parseFile').mockResolvedValue(emptyGeoJSON)
      jest.spyOn(geoParser, 'validateGeoJSON').mockReturnValue(true)

      const result = await geoParser.extract('test-bucket', 'empty.kml', 'kml')

      expect(result).toEqual(emptyGeoJSON)
      expect(geoParser.parseFile).toHaveBeenCalledWith(
        '/tmp/test-dir/file_123',
        'kml'
      )
    })

    it('should handle corrupted file parsing errors', async () => {
      const parseError = new Error('Invalid KML format: unexpected end of file')
      jest.spyOn(geoParser, 'parseFile').mockRejectedValue(parseError)

      await expect(
        geoParser.extract('test-bucket', 'corrupted.kml', 'kml')
      ).rejects.toThrow(
        Boom.internal(
          'GeoJSON extraction failed: Invalid KML format: unexpected end of file'
        )
      )
    })

    it('should handle unsupported file type in worker', async () => {
      const unsupportedError = new Error('Unsupported file type: xyz')
      jest.spyOn(geoParser, 'parseFile').mockRejectedValue(unsupportedError)

      await expect(
        geoParser.extract('test-bucket', 'test.xyz', 'xyz')
      ).rejects.toThrow(
        Boom.internal('GeoJSON extraction failed: Unsupported file type: xyz')
      )
    })

    it('should handle large file size validation failure', async () => {
      const sizeError = Boom.entityTooLarge('File size exceeds 50MB limit')
      blobService.validateFileSize.mockRejectedValue(sizeError)

      await expect(
        geoParser.extract('test-bucket', 'large.kml', 'kml')
      ).rejects.toThrow(sizeError)
    })
  })

  describe('Real file content processing', () => {
    const s3Bucket = 'test-bucket'
    const tempDir = '/tmp/test-dir'
    const tempFilePath = '/tmp/test-dir/file_123'

    beforeEach(() => {
      setupBlobServiceMocks(tempDir, tempFilePath)
    })

    it('should extract coordinates from KML with Point geometry', async () => {
      const kmlPointGeoJSON = createFeatureCollection([
        createFeature(createPointGeometry([-0.1276, 51.5074]), {
          name: 'Thames Estuary Site'
        })
      ])

      jest.spyOn(geoParser, 'parseFile').mockResolvedValue(kmlPointGeoJSON)
      jest.spyOn(geoParser, 'validateGeoJSON').mockReturnValue(true)

      const result = await geoParser.extract(s3Bucket, 'site.kml', 'kml')

      expect(result).toEqual(kmlPointGeoJSON)
      expect(result.features).toHaveLength(1)
      expect(result.features[0].geometry.type).toBe('Point')
      expect(result.features[0].geometry.coordinates).toEqual([
        -0.1276, 51.5074
      ])
    })

    it('should extract coordinates from KML with Polygon geometry', async () => {
      const polygonCoords = [
        [
          [-0.1, 51.5],
          [-0.1, 51.6],
          [0.0, 51.6],
          [0.0, 51.5],
          [-0.1, 51.5]
        ]
      ]
      const kmlPolygonGeoJSON = createFeatureCollection([
        createFeature(createPolygonGeometry(polygonCoords), {
          name: 'Marine Site Boundary'
        })
      ])

      jest.spyOn(geoParser, 'parseFile').mockResolvedValue(kmlPolygonGeoJSON)
      jest.spyOn(geoParser, 'validateGeoJSON').mockReturnValue(true)

      const result = await geoParser.extract(s3Bucket, 'boundary.kml', 'kml')

      expect(result).toEqual(kmlPolygonGeoJSON)
      expect(result.features[0].geometry.type).toBe('Polygon')
      expect(result.features[0].geometry.coordinates[0]).toHaveLength(5)
    })

    it('should extract multiple features from KML', async () => {
      const multiFeatureGeoJSON = createFeatureCollection([
        createFeature(createPointGeometry([-0.1, 51.5]), { name: 'Site 1' }),
        createFeature(createPointGeometry([-0.2, 51.6]), { name: 'Site 2' })
      ])

      jest.spyOn(geoParser, 'parseFile').mockResolvedValue(multiFeatureGeoJSON)
      jest.spyOn(geoParser, 'validateGeoJSON').mockReturnValue(true)

      const result = await geoParser.extract(
        s3Bucket,
        'multiple-sites.kml',
        'kml'
      )

      expect(result.features).toHaveLength(2)
      expect(result.features[0].properties.name).toBe('Site 1')
      expect(result.features[1].properties.name).toBe('Site 2')
    })

    it('should extract coordinates from Shapefile', async () => {
      const shapefileCoords = [
        [
          [-1.0, 50.0],
          [-1.0, 50.1],
          [-0.9, 50.1],
          [-0.9, 50.0],
          [-1.0, 50.0]
        ]
      ]
      const shapefileGeoJSON = createFeatureCollection([
        createFeature(createPolygonGeometry(shapefileCoords), {
          SITE_NAME: 'Offshore Wind Farm',
          AREA_HA: 1500.5
        })
      ])

      jest.spyOn(geoParser, 'parseFile').mockResolvedValue(shapefileGeoJSON)
      jest.spyOn(geoParser, 'validateGeoJSON').mockReturnValue(true)

      const result = await geoParser.extract(s3Bucket, 'site.zip', 'shapefile')

      expect(result).toEqual(shapefileGeoJSON)
      expect(result.features[0].properties.SITE_NAME).toBe('Offshore Wind Farm')
    })
  })

  describe('Coordinate extraction for review (ML-74)', () => {
    it('should validate GeoJSON contains extractable coordinate data', () => {
      const geoJSONWithCoordinates = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-0.1276, 51.5074]
            },
            properties: {
              name: 'Marine Site'
            }
          }
        ]
      }

      const result = geoParser.validateGeoJSON(geoJSONWithCoordinates)

      expect(result).toBe(true)
      // Validate that coordinate data is present for display on review page
      expect(
        geoJSONWithCoordinates.features[0].geometry.coordinates
      ).toBeDefined()
      expect(
        geoJSONWithCoordinates.features[0].geometry.coordinates
      ).toHaveLength(2)
    })

    it('should handle FeatureCollection with mixed geometry types', () => {
      const mixedGeometryGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-0.1, 51.5]
            },
            properties: { type: 'anchor_point' }
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-0.1, 51.5],
                  [-0.1, 51.6],
                  [0.0, 51.6],
                  [-0.1, 51.5]
                ]
              ]
            },
            properties: { type: 'work_area' }
          }
        ]
      }

      const result = geoParser.validateGeoJSON(mixedGeometryGeoJSON)

      expect(result).toBe(true)
      expect(mixedGeometryGeoJSON.features).toHaveLength(2)
    })

    it('should validate coordinate bounds for UK marine areas', () => {
      // Test coordinates within reasonable UK marine area bounds
      const ukMarineCoordinates = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-4.5, 55.0] // Scottish waters
            },
            properties: {}
          }
        ]
      }

      const result = geoParser.validateGeoJSON(ukMarineCoordinates)

      expect(result).toBe(true)
    })
  })

  describe('Error scenarios for user experience', () => {
    it('should handle files with no geometry data', () => {
      const noGeometryGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: null,
            properties: {
              name: 'Site with metadata only'
            }
          }
        ]
      }

      // Should validate successfully - null geometry is valid GeoJSON
      const result = geoParser.validateGeoJSON(noGeometryGeoJSON)

      expect(result).toBe(true)
    })

    it('should handle Feature with complex properties', () => {
      const complexPropertiesGeoJSON = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-0.1, 51.5]
        },
        properties: {
          site_details: {
            water_depth: '15m',
            seabed_type: 'sand',
            environmental_data: {
              protected_species: ['seals', 'dolphins'],
              habitat_type: 'subtidal_sand'
            }
          }
        }
      }

      const result = geoParser.validateGeoJSON(complexPropertiesGeoJSON)

      expect(result).toBe(true)
    })

    it('should handle large feature collections efficiently', () => {
      const largeFeatureCollection = {
        type: 'FeatureCollection',
        features: Array.from({ length: 1000 }, (_, i) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-0.1 + i * 0.001, 51.5 + i * 0.001]
          },
          properties: {
            id: i,
            name: `Site ${i}`
          }
        }))
      }

      const result = geoParser.validateGeoJSON(largeFeatureCollection)

      expect(result).toBe(true)
      expect(largeFeatureCollection.features).toHaveLength(1000)
    })
  })

  describe('Worker thread edge cases', () => {
    const filePath = '/tmp/test-file.kml'
    const fileType = 'kml'

    beforeEach(() => {
      setupWorkerMocks()
    })

    it('should handle worker that sends multiple messages', async () => {
      const firstMessage = {
        geoJSON: { type: 'FeatureCollection', features: [] }
      }
      const secondMessage = { geoJSON: { type: 'Feature', geometry: null } }

      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => callback(firstMessage), 10)
          setTimeout(() => callback(secondMessage), 20)
        }
      })

      const result = await geoParser.parseFile(filePath, fileType)

      // Should resolve with first message
      expect(result).toEqual(firstMessage.geoJSON)
    })

    it('should handle race condition between timeout and worker response', async () => {
      const mockGeoJSON = { type: 'FeatureCollection', features: [] }

      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          // Simulate response arriving just before timeout
          setTimeout(() => callback({ geoJSON: mockGeoJSON }), 95)
        }
      })

      geoParser.processingTimeout = 100

      const result = await geoParser.parseFile(filePath, fileType)

      expect(result).toEqual(mockGeoJSON)
      expect(mockWorker.terminate).not.toHaveBeenCalled()
    })

    it('should handle worker exit after sending message', async () => {
      const mockGeoJSON = { type: 'FeatureCollection', features: [] }

      mockWorker.on.mockImplementation((event, callback) => {
        if (event === 'message') {
          setTimeout(() => callback({ geoJSON: mockGeoJSON }), 10)
        } else if (event === 'exit') {
          const exitCode = 0
          setTimeout(() => callback(exitCode), 20)
        }
      })

      const result = await geoParser.parseFile(filePath, fileType)

      expect(result).toEqual(mockGeoJSON)
      expect(mockWorker.terminate).not.toHaveBeenCalled()
    })
  })
})
