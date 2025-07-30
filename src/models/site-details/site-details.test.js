import { siteDetailsSchema } from './site-details.js'
import { COORDINATE_SYSTEMS } from '../../common/constants/coordinates.js'
import {
  mockSiteDetails,
  mockSiteDetailsRequest,
  mockFileUploadSiteDetailsRequest,
  mockId
} from './test-fixtures.js'

describe('#siteDetails schema', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('#siteDetails', () => {
    test('Should correctly validate on valid data', () => {
      const result = siteDetailsSchema.validate(mockSiteDetailsRequest)
      expect(result.error).toBeUndefined()
    })

    test('Should correctly validate on empty data', () => {
      const result = siteDetailsSchema.validate({})
      expect(result.error.message).toBe('SITE_DETAILS_REQUIRED')
    })

    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({ id: mockId })
      expect(result.error.message).toBe('SITE_DETAILS_REQUIRED')
    })
  })

  describe('#coordinatesEntry', () => {
    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, coordinatesEntry: 'invalid' }
      })
      expect(result.error.message).toBe('COORDINATES_ENTRY_REQUIRED')
    })

    test('Should correctly validate on empty data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, coordinatesEntry: null }
      })
      expect(result.error.message).toBe('COORDINATES_ENTRY_REQUIRED')
    })
  })

  describe('#coordinatesType', () => {
    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, coordinatesType: 'invalid' }
      })
      expect(result.error.message).toBe('PROVIDE_COORDINATES_CHOICE_REQUIRED')
    })

    test('Should correctly validate on empty data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, coordinatesType: null }
      })
      expect(result.error.message).toBe('PROVIDE_COORDINATES_CHOICE_REQUIRED')
    })
  })

  describe('#coordinateSystem', () => {
    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, coordinateSystem: 'invalid' }
      })
      expect(result.error.message).toBe('COORDINATE_SYSTEM_REQUIRED')
    })

    test('Should correctly validate on empty data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, coordinateSystem: null }
      })
      expect(result.error.message).toBe('COORDINATE_SYSTEM_REQUIRED')
    })
  })

  describe('#width', () => {
    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, circleWidth: 'invalid' }
      })
      expect(result.error.message).toBe('WIDTH_INVALID')
    })

    test('Should correctly validate on empty data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, circleWidth: null }
      })

      expect(result.error.message).toBe('WIDTH_REQUIRED')
    })

    test('Should correctly validate when width is below minimum allowed value', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, circleWidth: '0' }
      })

      expect(result.error.message).toBe('WIDTH_MIN')
    })

    test('Should correctly validate when width is a negative number', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, circleWidth: '-5' }
      })

      expect(result.error.message).toBe('WIDTH_MIN')
    })

    test('Should correctly validate when width contains incorrect characters', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, circleWidth: 'test' }
      })

      expect(result.error.message).toBe('WIDTH_INVALID')
    })

    test('Should correctly validate when width is not an integer', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: { ...mockSiteDetails, circleWidth: '12.2' }
      })

      expect(result.error.message).toBe('WIDTH_NON_INTEGER')
    })
  })

  describe('#coordinates', () => {
    test('Should correctly errors when incorrect coordinates OSGB36', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: {
          ...mockSiteDetails,
          coordinateSystem: COORDINATE_SYSTEMS.OSGB36
        }
      })
      expect(result.error.message).toBe('EASTINGS_REQUIRED')
    })

    test('Should correctly errors when incorrect coordinates WGS84', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: {
          ...mockSiteDetails,
          coordinates: { eastings: '123456', northings: '123456' }
        }
      })
      expect(result.error.message).toBe('LATITUDE_REQUIRED')
    })
  })

  describe('#file upload validation', () => {
    test('Should correctly validate file upload data', () => {
      const result = siteDetailsSchema.validate(
        mockFileUploadSiteDetailsRequest
      )
      expect(result.error).toBeUndefined()
    })

    test('Should correctly validate the exact data structure from production error', () => {
      const productionData = {
        siteDetails: {
          coordinatesType: 'file',
          fileUploadType: 'kml',
          geoJSON: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [-1.6037083838360786, 55.08150239432132],
                    [-1.7930481641727738, 54.95753857504246],
                    [-1.4723509092498546, 54.93725630538344],
                    [-1.4910720035708493, 55.09085853021563],
                    [-1.642244053697766, 55.08009968965797]
                  ]
                },
                properties: {}
              }
            ]
          },
          featureCount: 1,
          uploadedFile: {
            filename: 'la Garde côtière.kml'
          },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key:
              'exemptions/cc8986fd-586a-4b27-988c-43d6d9c2306a/26e258bb-f6ef-43cf-b102-80f9195014c8',
            checksumSha256: 'edpLwm1vcMM2G5PzuyLr4hlxdLxHcjTjXFye3X3WGXo='
          }
        },
        id: '68811d2a64a5901f5ea56cb5'
      }

      const result = siteDetailsSchema.validate(productionData)
      expect(result.error).toBeUndefined()
    })

    test('Should reject manual coordinate fields when coordinatesType is file', () => {
      const result = siteDetailsSchema.validate({
        ...mockFileUploadSiteDetailsRequest,
        siteDetails: {
          ...mockFileUploadSiteDetailsRequest.siteDetails,
          coordinatesEntry: 'single', // This should be forbidden for file uploads
          coordinateSystem: 'wgs84'
        }
      })
      expect(result.error.message).toContain('coordinatesEntry')
      expect(result.error.message).toContain('not allowed')
    })

    test('Should reject file upload fields when coordinatesType is coordinates', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: {
          ...mockSiteDetails,
          fileUploadType: 'kml', // This should be forbidden for manual coordinates
          geoJSON: { type: 'FeatureCollection', features: [] }
        }
      })
      expect(result.error.message).toContain('fileUploadType')
      expect(result.error.message).toContain('not allowed')
    })

    test('Should require all file upload fields when coordinatesType is file', () => {
      const result = siteDetailsSchema.validate({
        id: mockId,
        siteDetails: {
          coordinatesType: 'file',
          fileUploadType: 'kml',
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key: 'test-file-key',
            checksumSha256: 'test-checksum'
          },
          featureCount: 1
          // Missing required field: geoJSON
        }
      })
      expect(result.error.message).toBe('GEO_JSON_REQUIRED')
    })
  })
})
