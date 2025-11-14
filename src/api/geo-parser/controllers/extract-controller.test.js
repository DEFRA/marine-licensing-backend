import { vi } from 'vitest'
import { extractController } from './extract-controller.js'
import { geoParser } from '../../../services/geo-parser/geo-parser.js'
import { config } from '../../../config.js'
import { StatusCodes } from 'http-status-codes'
import Boom from '@hapi/boom'

vi.mock('../../../services/geo-parser/geo-parser.js', () => ({
  geoParser: {
    extract: vi.fn()
  }
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

vi.mock('../../../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })),
  structureErrorForECS: vi.fn((error) => ({
    error: {
      message: error?.message || String(error),
      stack_trace: error?.stack,
      type: error?.name || error?.constructor?.name || 'Error',
      code: error?.code || error?.statusCode
    }
  }))
}))

describe('Extract Controller', () => {
  const payloadValidator = extractController.options.validate.payload

  beforeEach(() => {
    config.get.mockReturnValue('mmo-uploads')
  })

  const validPayload = {
    s3Bucket: 'mmo-uploads',
    s3Key: 'valid-key.kml',
    fileType: 'kml'
  }

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

  describe('Payload Validation', () => {
    it('should fail when s3Bucket is missing', () => {
      const invalidPayload = {
        s3Key: 'valid-key.kml',
        fileType: 'kml'
      }

      const result = payloadValidator.validate(invalidPayload)
      expect(result.error.message).toContain('S3_BUCKET_REQUIRED')
    })

    it('should fail when s3Key is missing', () => {
      const invalidPayload = {
        s3Bucket: 'mmo-uploads',
        fileType: 'kml'
      }

      const result = payloadValidator.validate(invalidPayload)
      expect(result.error.message).toContain('S3_KEY_REQUIRED')
    })

    it('should fail when fileType is missing', () => {
      const invalidPayload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'valid-key.kml'
      }

      const result = payloadValidator.validate(invalidPayload)
      expect(result.error.message).toContain('FILE_TYPE_REQUIRED')
    })

    it('should fail when fileType is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        fileType: 'invalid'
      }

      const result = payloadValidator.validate(invalidPayload)
      expect(result.error.message).toContain('FILE_TYPE_INVALID')
    })

    it('should fail when s3Key contains path traversal', () => {
      const invalidPayload = {
        ...validPayload,
        s3Key: '../../../etc/passwd'
      }

      const result = payloadValidator.validate(invalidPayload)
      expect(result.error.message).toContain('S3_KEY_INVALID')
    })

    it('should fail when s3Key is too long', () => {
      const longKey = 'a'.repeat(1025)
      const invalidPayload = {
        ...validPayload,
        s3Key: longKey
      }

      const result = payloadValidator.validate(invalidPayload)
      expect(result.error.message).toContain('S3_KEY_INVALID')
    })

    it('should fail when s3Key contains invalid characters', () => {
      const invalidPayload = {
        ...validPayload,
        s3Key: 'invalid<>key'
      }

      const result = payloadValidator.validate(invalidPayload)
      expect(result.error.message).toContain('S3_KEY_INVALID')
    })

    it('should accept valid payload', () => {
      const result = payloadValidator.validate(validPayload)
      expect(result.error).toBeUndefined()
    })

    it('should normalize fileType to lowercase', () => {
      const upperCasePayload = {
        ...validPayload,
        fileType: 'KML'
      }

      const result = payloadValidator.validate(upperCasePayload)
      expect(result.error).toBeUndefined()
      expect(result.value.fileType).toBe('kml')
    })
  })

  describe('Handler - Success Cases', () => {
    it('should successfully extract GeoJSON from KML file', async () => {
      const { mockHandler } = global
      geoParser.extract.mockResolvedValue(mockGeoJSON)

      const mockRequest = {
        payload: validPayload
      }

      await extractController.handler(mockRequest, mockHandler)

      expect(geoParser.extract).toHaveBeenCalledWith(
        'mmo-uploads',
        'valid-key.kml',
        'kml'
      )
      expect(mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: mockGeoJSON
      })
      expect(mockHandler.code).toHaveBeenCalledWith(StatusCodes.OK)
    })

    it('should successfully extract GeoJSON from shapefile', async () => {
      const { mockHandler } = global
      const shapefilePayload = {
        ...validPayload,
        s3Key: 'shapefile.zip',
        fileType: 'shapefile'
      }
      geoParser.extract.mockResolvedValue(mockGeoJSON)

      const mockRequest = {
        payload: shapefilePayload
      }

      await extractController.handler(mockRequest, mockHandler)

      expect(geoParser.extract).toHaveBeenCalledWith(
        'mmo-uploads',
        'shapefile.zip',
        'shapefile'
      )
      expect(mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: mockGeoJSON
      })
      expect(mockHandler.code).toHaveBeenCalledWith(StatusCodes.OK)
    })

    it('should handle GeoJSON with no features', async () => {
      const { mockHandler } = global
      const emptyGeoJSON = {
        type: 'FeatureCollection',
        features: []
      }
      geoParser.extract.mockResolvedValue(emptyGeoJSON)

      const mockRequest = {
        payload: validPayload
      }

      await extractController.handler(mockRequest, mockHandler)

      expect(mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: emptyGeoJSON
      })
    })

    it('should handle GeoJSON with multiple features', async () => {
      const { mockHandler } = global
      const multiFeatureGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-0.1, 51.5] },
            properties: {}
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-0.2, 51.6] },
            properties: {}
          }
        ]
      }
      geoParser.extract.mockResolvedValue(multiFeatureGeoJSON)

      const mockRequest = {
        payload: validPayload
      }

      await extractController.handler(mockRequest, mockHandler)

      expect(mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: multiFeatureGeoJSON
      })
    })
  })

  describe('Handler - S3 Bucket Validation', () => {
    it('should throw forbidden error when s3Bucket does not match config', async () => {
      const { mockHandler } = global
      const invalidPayload = {
        ...validPayload,
        s3Bucket: 'wrong-bucket'
      }

      const mockRequest = {
        payload: invalidPayload
      }

      await expect(
        extractController.handler(mockRequest, mockHandler)
      ).rejects.toThrow(Boom.forbidden('Invalid S3 bucket'))

      expect(geoParser.extract).not.toHaveBeenCalled()
    })

    it('should validate against configured bucket name', async () => {
      const { mockHandler } = global
      config.get.mockReturnValue('different-bucket')
      const payload = {
        ...validPayload,
        s3Bucket: 'different-bucket'
      }
      geoParser.extract.mockResolvedValue(mockGeoJSON)

      const mockRequest = {
        payload
      }

      await extractController.handler(mockRequest, mockHandler)

      expect(geoParser.extract).toHaveBeenCalled()
      expect(mockHandler.response).toHaveBeenCalledWith({
        message: 'success',
        value: mockGeoJSON
      })
    })
  })

  describe('Handler - Error Cases', () => {
    it('should throw internal server error when geoParser throws generic error', async () => {
      const { mockHandler } = global
      const error = new Error('Processing failed')
      geoParser.extract.mockRejectedValue(error)

      const mockRequest = {
        payload: validPayload
      }

      await expect(
        extractController.handler(mockRequest, mockHandler)
      ).rejects.toThrow(
        Boom.internal('Extract processing failed: Processing failed')
      )
    })

    it('should propagate Boom errors from geoParser', async () => {
      const { mockHandler } = global
      const boomError = Boom.notFound('File not found')
      geoParser.extract.mockRejectedValue(boomError)

      const mockRequest = {
        payload: validPayload
      }

      await expect(
        extractController.handler(mockRequest, mockHandler)
      ).rejects.toThrow(boomError)
    })

    it('should handle timeout errors from geoParser', async () => {
      const { mockHandler } = global
      const timeoutError = Boom.clientTimeout('Processing timeout')
      geoParser.extract.mockRejectedValue(timeoutError)

      const mockRequest = {
        payload: validPayload
      }

      await expect(
        extractController.handler(mockRequest, mockHandler)
      ).rejects.toThrow(timeoutError)
    })

    it('should handle file size errors from geoParser', async () => {
      const { mockHandler } = global
      const sizeError = Boom.entityTooLarge('File too large')
      geoParser.extract.mockRejectedValue(sizeError)

      const mockRequest = {
        payload: validPayload
      }

      await expect(
        extractController.handler(mockRequest, mockHandler)
      ).rejects.toThrow(sizeError)
    })
  })
})
