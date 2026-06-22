import { vi, expect } from 'vitest'
import { GeoParser } from './geo-parser.js'
import { Worker } from 'node:worker_threads'
import { blobService } from '../data-service/blob-service.js'
import Boom from '@hapi/boom'
import { join } from 'node:path'
import { GEO_PARSER_ERROR_CODES } from './error-codes.js'

vi.mock('node:worker_threads', () => ({
  Worker: vi.fn(function () {})
}))

vi.mock('../data-service/blob-service.js', () => ({
  blobService: {
    createTempDirectory: vi.fn(),
    validateFileSize: vi.fn(),
    downloadFile: vi.fn(),
    cleanupTempDirectory: vi.fn()
  }
}))

vi.mock('../../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(function () {
    return {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    }
  }),
  structureErrorForECS: vi.fn((error) => ({
    error: {
      message: error?.message || String(error),
      stack_trace: error?.stack,
      type: error?.name || error?.constructor?.name || 'Error',
      code: error?.code || error?.statusCode
    }
  }))
}))

vi.mock('node:path', () => ({
  join: vi.fn()
}))

describe('GeoParser', () => {
  let geoParser
  let mockWorker

  beforeEach(() => {
    // Mock setImmediate to execute synchronously
    global.setImmediate = vi.fn((cb) => cb())

    mockWorker = {
      on: vi.fn(),
      terminate: vi.fn()
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

      vi.spyOn(geoParser, 'parseFile').mockResolvedValue(mockGeoJSON)
      vi.spyOn(geoParser, 'validateGeoJSON').mockReturnValue(true)
      vi.spyOn(geoParser, 'validateFeatureGeometryTypes').mockReturnValue(true)
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
      geoParser.validateGeoJSON.mockImplementation(function () {
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

    it('should throw Boom.badRequest for GeoParserErrorCode errors', async () => {
      const geoParserError = new Error('SHAPEFILE_MISSING_CORE_FILES')
      geoParser.parseFile.mockRejectedValue(geoParserError)

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(Boom.badRequest('SHAPEFILE_MISSING_CORE_FILES'))
    })

    it('should throw Boom.badRequest when geoJSON contains a point or line feature', async () => {
      geoParser.validateFeatureGeometryTypes.mockImplementation(() => {
        throw new Error(GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE)
      })

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(
        Boom.badRequest(GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE)
      )

      expect(geoParser.validateFeatureGeometryTypes).toHaveBeenCalledWith(
        mockGeoJSON
      )
    })

    it('should throw Boom.badRequest when geoJSON contains no features', async () => {
      geoParser.validateGeoJSON.mockImplementation(() => {
        throw new Error(GEO_PARSER_ERROR_CODES.NO_SITE_BOUNDARIES)
      })

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType)
      ).rejects.toThrow(
        Boom.badRequest(GEO_PARSER_ERROR_CODES.NO_SITE_BOUNDARIES)
      )

      expect(geoParser.validateGeoJSON).toHaveBeenCalledWith(mockGeoJSON)
    })

    it('should call validateSingleSite when singleSiteOnly is true', async () => {
      vi.spyOn(geoParser, 'validateSingleSite').mockReturnValue(true)

      await geoParser.extract(s3Bucket, s3Key, fileType, {
        singleSiteOnly: true
      })

      expect(geoParser.validateSingleSite).toHaveBeenCalledWith(mockGeoJSON)
    })

    it('should not call validateSingleSite when singleSiteOnly is not provided', async () => {
      vi.spyOn(geoParser, 'validateSingleSite').mockReturnValue(true)

      await geoParser.extract(s3Bucket, s3Key, fileType)

      expect(geoParser.validateSingleSite).not.toHaveBeenCalled()
    })

    it('should throw Boom.badRequest when singleSiteOnly validation fails', async () => {
      vi.spyOn(geoParser, 'validateSingleSite').mockImplementation(() => {
        throw new Error(GEO_PARSER_ERROR_CODES.SINGLE_SITE_ONLY)
      })

      await expect(
        geoParser.extract(s3Bucket, s3Key, fileType, { singleSiteOnly: true })
      ).rejects.toThrow(
        Boom.badRequest(GEO_PARSER_ERROR_CODES.SINGLE_SITE_ONLY)
      )
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

      mockWorker = {
        on: vi.fn(),
        terminate: vi.fn()
      }
      Worker.mockImplementation(function () {
        return mockWorker
      })
    })

    it('should successfully parse file using worker thread', async () => {
      mockWorker.on.mockImplementation(function (event, callback) {
        if (event === 'message') {
          // Simulate successful message
          setTimeout(() => callback({ geoJSON: mockGeoJSON }), 10)
        }
      })

      const result = await geoParser.parseFile(filePath, fileType)

      expect(result).toEqual(mockGeoJSON)
      expect(Worker).toHaveBeenCalledWith(
        './src/shared/services/geo-parser/worker.js',
        {
          workerData: { filePath, fileType }
        }
      )
    })

    it('should handle worker error messages', async () => {
      mockWorker.on.mockImplementation(function (event, callback) {
        if (event === 'message') {
          setTimeout(() => callback({ error: 'Parse failed' }), 10)
        }
      })

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        'Parse failed'
      )
    })

    it('should handle worker error event', async () => {
      mockWorker.on.mockImplementation(function (event, callback) {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Worker error')), 10)
        }
      })

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        'Worker error: Worker error'
      )
    })

    it('should handle worker exit with non-zero code', async () => {
      mockWorker.on.mockImplementation(function (event, callback) {
        if (event === 'exit') {
          // Worker exit event handler expects exit code (number) as first parameter
          // eslint-disable-next-line n/no-callback-literal
          setTimeout(() => callback(1), 10)
        }
      })

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        'Worker stopped with exit code 1'
      )
    })

    it('should handle worker exit with exit code 0', async () => {
      mockWorker.on.mockImplementation(function (event, callback) {
        if (event === 'exit') {
          // Worker exit event handler expects exit code (number) as first parameter
          // eslint-disable-next-line n/no-callback-literal
          setTimeout(() => callback(0), 10)
        }
      })

      let rejected = false
      geoParser.parseFile(filePath, fileType).catch(() => {
        rejected = true
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(rejected).toBe(false)
    })

    it('should timeout after processing timeout', async () => {
      mockWorker.on.mockImplementation(function () {
        // Worker never responds
      })

      // Override timeout for faster test
      geoParser.processingTimeout = 100

      await expect(geoParser.parseFile(filePath, fileType)).rejects.toThrow(
        'Processing timeout exceeded'
      )

      expect(mockWorker.terminate).toHaveBeenCalled()
    })

    it('should clear timeout when worker responds', async () => {
      mockWorker.on.mockImplementation(function (event, callback) {
        if (event === 'message') {
          setTimeout(() => callback({ geoJSON: mockGeoJSON }), 10)
        }
      })

      await geoParser.parseFile(filePath, fileType)

      expect(mockWorker.terminate).not.toHaveBeenCalled()
    })

    it('should clear timeout when worker has error', async () => {
      mockWorker.on.mockImplementation(function (event, callback) {
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

    it('should throw NO_SITE_BOUNDARIES when FeatureCollection has empty features', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: []
      }

      expect(() => geoParser.validateGeoJSON(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.NO_SITE_BOUNDARIES
      )
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
      JSON.stringify = vi.fn(() => {
        // Return a string that simulates large size calculation
        return 'x'.repeat(1000) // Small actual string
      })

      // Mock Buffer.byteLength to return a size that exceeds the limit
      const originalByteLength = Buffer.byteLength
      Buffer.byteLength = vi.fn(() => 600_000_000) // 600MB > 500MB limit

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

  describe('validateFeatureGeometryTypes', () => {
    const polygonFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.1, 51.5],
            [-0.2, 51.5],
            [-0.2, 51.6],
            [-0.1, 51.6],
            [-0.1, 51.5]
          ]
        ]
      },
      properties: {}
    }

    const multiPolygonFeature = {
      type: 'Feature',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-0.1, 51.5],
              [-0.2, 51.5],
              [-0.2, 51.6],
              [-0.1, 51.6],
              [-0.1, 51.5]
            ]
          ]
        ]
      },
      properties: {}
    }

    const pointFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-0.1, 51.5] },
      properties: {}
    }

    const lineStringFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.1, 51.5],
          [-0.2, 51.6]
        ]
      },
      properties: {}
    }

    const multiPointFeature = {
      type: 'Feature',
      geometry: {
        type: 'MultiPoint',
        coordinates: [
          [-0.1, 51.5],
          [-0.2, 51.6]
        ]
      },
      properties: {}
    }

    const multiLineStringFeature = {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-0.1, 51.5],
            [-0.2, 51.6]
          ]
        ]
      },
      properties: {}
    }

    const geometryCollectionWithPointFeature = {
      type: 'Feature',
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'Polygon',
            coordinates: [
              [
                [-0.1, 51.5],
                [-0.2, 51.5],
                [-0.2, 51.6],
                [-0.1, 51.6],
                [-0.1, 51.5]
              ]
            ]
          },
          { type: 'Point', coordinates: [-0.3, 51.7] }
        ]
      },
      properties: {}
    }

    const nestedGeometryCollectionWithLineFeature = {
      type: 'Feature',
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'GeometryCollection',
            geometries: [
              {
                type: 'LineString',
                coordinates: [
                  [-0.1, 51.5],
                  [-0.2, 51.6]
                ]
              }
            ]
          }
        ]
      },
      properties: {}
    }

    it('should pass when FeatureCollection contains only polygon features', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature, multiPolygonFeature]
      }

      expect(geoParser.validateFeatureGeometryTypes(geoJSON)).toBe(true)
    })

    it('should pass when FeatureCollection has no features', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: []
      }

      expect(geoParser.validateFeatureGeometryTypes(geoJSON)).toBe(true)
    })

    it('should pass when single Feature is a Polygon', () => {
      expect(geoParser.validateFeatureGeometryTypes(polygonFeature)).toBe(true)
    })

    it('should throw FEATURES_CONTAIN_POINT_OR_LINE when any feature is a Point', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature, pointFeature]
      }

      expect(() => geoParser.validateFeatureGeometryTypes(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE
      )
    })

    it('should throw FEATURES_CONTAIN_POINT_OR_LINE when any feature is a LineString', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature, lineStringFeature]
      }

      expect(() => geoParser.validateFeatureGeometryTypes(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE
      )
    })

    it('should throw FEATURES_CONTAIN_POINT_OR_LINE when any feature is a MultiPoint', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature, multiPointFeature]
      }

      expect(() => geoParser.validateFeatureGeometryTypes(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE
      )
    })

    it('should throw FEATURES_CONTAIN_POINT_OR_LINE when any feature is a MultiLineString', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature, multiLineStringFeature]
      }

      expect(() => geoParser.validateFeatureGeometryTypes(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE
      )
    })

    it('should throw when GeometryCollection contains a Point', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature, geometryCollectionWithPointFeature]
      }

      expect(() => geoParser.validateFeatureGeometryTypes(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE
      )
    })

    it('should throw when nested GeometryCollection contains a LineString', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature, nestedGeometryCollectionWithLineFeature]
      }

      expect(() => geoParser.validateFeatureGeometryTypes(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE
      )
    })

    const nestGeometryCollections = (wrapperCount, innerGeometry) => {
      let geometry = innerGeometry
      for (let i = 0; i < wrapperCount; i++) {
        geometry = { type: 'GeometryCollection', geometries: [geometry] }
      }
      return geometry
    }

    it('should pass when GeometryCollection nesting is at the depth limit', () => {
      const geometry = nestGeometryCollections(20, polygonFeature.geometry)
      const feature = { type: 'Feature', geometry, properties: {} }
      const geoJSON = { type: 'FeatureCollection', features: [feature] }

      expect(geoParser.validateFeatureGeometryTypes(geoJSON)).toBe(true)
    })

    it('should throw GEOMETRY_NESTING_TOO_DEEP when GeometryCollection nesting exceeds limit', () => {
      const geometry = nestGeometryCollections(21, polygonFeature.geometry)
      const feature = { type: 'Feature', geometry, properties: {} }
      const geoJSON = { type: 'FeatureCollection', features: [feature] }

      expect(() => geoParser.validateFeatureGeometryTypes(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.GEOMETRY_NESTING_TOO_DEEP
      )
    })

    it('should throw when single Feature is a Point', () => {
      expect(() =>
        geoParser.validateFeatureGeometryTypes(pointFeature)
      ).toThrow(GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE)
    })

    it('should reject the entire file when only one of many features is invalid', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature, polygonFeature, pointFeature, polygonFeature]
      }

      expect(() => geoParser.validateFeatureGeometryTypes(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE
      )
    })

    it('should pass when FeatureCollection has features without geometry', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {} }]
      }

      expect(geoParser.validateFeatureGeometryTypes(geoJSON)).toBe(true)
    })

    it('should pass when features is not an array', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: null
      }

      expect(geoParser.validateFeatureGeometryTypes(geoJSON)).toBe(true)
    })
  })

  describe('validateSingleSite', () => {
    const polygonFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.1, 51.5],
            [-0.2, 51.5],
            [-0.2, 51.6],
            [-0.1, 51.6],
            [-0.1, 51.5]
          ]
        ]
      },
      properties: {}
    }

    it('should pass when FeatureCollection has exactly one feature', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature]
      }

      expect(geoParser.validateSingleSite(geoJSON)).toBe(true)
    })

    it('should pass when FeatureCollection has no features', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: []
      }

      expect(geoParser.validateSingleSite(geoJSON)).toBe(true)
    })

    it('should throw SINGLE_SITE_ONLY when FeatureCollection has more than one feature', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [polygonFeature, polygonFeature]
      }

      expect(() => geoParser.validateSingleSite(geoJSON)).toThrow(
        GEO_PARSER_ERROR_CODES.SINGLE_SITE_ONLY
      )
    })
  })
})
