import { COORDINATE_SYSTEMS } from '../../common/constants/coordinates.js'
import { siteDetailsSchema } from './site-details.js'
import {
  mockFileUploadSiteDetailsRequest,
  mockWgs84MultipleCoordinatesRequest,
  mockOsgb36MultipleCoordinatesRequest,
  mockId,
  mockSiteDetails,
  mockSiteDetailsRequest,
  mockSiteDetailsRequestWithMultiSite,
  mockSiteDetailsWithMultiSite,
  mockMultipleSiteDetails
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
      expect(result.error.message).toBe('MULTIPLE_SITE_DETAILS_REQUIRED')
    })

    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({
        id: mockId,
        multipleSiteDetails:
          mockFileUploadSiteDetailsRequest.multipleSiteDetails
      })
      expect(result.error.message).toBe('SITE_DETAILS_REQUIRED')
    })
  })

  describe('#multipleSiteDetails integration', () => {
    describe('when coordinatesType is "coordinates"', () => {
      test('Should require multipleSiteDetails when coordinatesType is coordinates', () => {
        const requestWithoutMultipleSiteDetails = {
          id: mockId,
          siteDetails: [
            {
              ...mockSiteDetails[0]
            }
          ]
        }
        const result = siteDetailsSchema.validate(
          requestWithoutMultipleSiteDetails
        )
        expect(result.error.message).toBe('MULTIPLE_SITE_DETAILS_REQUIRED')
      })
    })

    describe('when coordinatesType is "file"', () => {
      test('Should require multipleSiteDetails when coordinatesType is file', () => {
        const requestWithoutMultipleSiteDetails = {
          id: mockId,
          siteDetails: mockFileUploadSiteDetailsRequest.siteDetails
        }
        const result = siteDetailsSchema.validate(
          requestWithoutMultipleSiteDetails
        )
        expect(result.error.message).toBe('MULTIPLE_SITE_DETAILS_REQUIRED')
      })
    })
  })

  describe('#coordinatesEntry', () => {
    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], coordinatesEntry: 'invalid' }]
      })
      expect(result.error.message).toBe('COORDINATES_ENTRY_REQUIRED')
    })

    test('Should correctly validate on empty data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], coordinatesEntry: null }]
      })
      expect(result.error.message).toBe('COORDINATES_ENTRY_REQUIRED')
    })
  })

  describe('#coordinatesType', () => {
    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], coordinatesType: 'invalid' }]
      })
      expect(result.error.message).toBe('PROVIDE_COORDINATES_CHOICE_REQUIRED')
    })

    test('Should correctly validate on empty data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], coordinatesType: null }]
      })
      expect(result.error.message).toBe('PROVIDE_COORDINATES_CHOICE_REQUIRED')
    })
  })

  describe('#activityDates', () => {
    describe('when coordinatesType is "coordinates"', () => {
      test('Should fail when activityDates are missing', () => {
        const payload = {
          ...mockSiteDetailsRequest,
          siteDetails: [
            {
              ...mockSiteDetailsRequest.siteDetails[0],
              activityDates: undefined
            }
          ]
        }

        const result = siteDetailsSchema.validate(payload)
        expect(result.error.message).toContain('ACTIVITY_DATES_REQUIRED')
      })

      test('Should not fail when activityDates are defined', () => {
        const result = siteDetailsSchema.validate(
          mockSiteDetailsRequestWithMultiSite
        )
        expect(result.error).toBeUndefined()
      })
    })

    describe('when coordinatesType is "file"', () => {
      test('Should allow activityDates to be missing', () => {
        const result = siteDetailsSchema.validate({
          ...mockFileUploadSiteDetailsRequest,
          siteDetails: [
            {
              ...mockFileUploadSiteDetailsRequest.siteDetails[0],
              activityDates: undefined
            }
          ]
        })
        expect(result.error).toBeUndefined()
      })

      test('Should allow file upload without activityDates', () => {
        const result = siteDetailsSchema.validate(
          mockFileUploadSiteDetailsRequest
        )
        expect(result.error).toBeUndefined()
      })
    })
  })

  describe('#activityDescription', () => {
    describe('when coordinatesType is "coordinates"', () => {
      test('Should fail when activityDescription is missing', () => {
        const payload = {
          ...mockSiteDetailsRequest,
          siteDetails: [
            {
              ...mockSiteDetailsRequest.siteDetails[0],
              activityDescription: undefined
            }
          ]
        }

        const result = siteDetailsSchema.validate(payload)
        expect(result.error.message).toContain('ACTIVITY_DESCRIPTION_REQUIRED')
      })

      test('Should not fail when activityDescription is defined', () => {
        const result = siteDetailsSchema.validate(
          mockSiteDetailsRequestWithMultiSite
        )
        expect(result.error).toBeUndefined()
      })
    })

    describe('when coordinatesType is "file"', () => {
      test('Should allow activityDescription to be missing', () => {
        const result = siteDetailsSchema.validate({
          ...mockFileUploadSiteDetailsRequest,
          siteDetails: [
            {
              ...mockFileUploadSiteDetailsRequest.siteDetails[0],
              activityDescription: undefined
            }
          ]
        })
        expect(result.error).toBeUndefined()
      })

      test('Should allow file upload without activityDescription', () => {
        const result = siteDetailsSchema.validate(
          mockFileUploadSiteDetailsRequest
        )
        expect(result.error).toBeUndefined()
      })
    })
  })

  describe('#siteName', () => {
    describe('when coordinatesType is "coordinates" and multipleSitesEnabled is false', () => {
      test('Should not allow siteName field to be present when multipleSitesEnabled is false', () => {
        const result = siteDetailsSchema.validate({
          multipleSiteDetails: { multipleSitesEnabled: false },
          siteDetails: [
            {
              ...mockSiteDetailsRequestWithMultiSite.siteDetails[0],
              activityDescription: 'test description'
            }
          ]
        })
        expect(result.error.message).toBe(
          '"siteDetails[0].siteName" is not allowed'
        )
      })

      test('Should not fail when siteName is missing', () => {
        const result = siteDetailsSchema.validate({
          ...mockSiteDetailsRequestWithMultiSite,
          siteDetails: [...mockSiteDetails],
          multipleSiteDetails: { multipleSitesEnabled: false }
        })
        expect(result.error).toBeUndefined()
      })

      test('Should not fail when siteName is undefined', () => {
        const result = siteDetailsSchema.validate({
          ...mockSiteDetailsRequestWithMultiSite,
          siteDetails: [
            {
              ...mockSiteDetails[0],
              siteName: undefined
            }
          ],
          multipleSiteDetails: { multipleSitesEnabled: false }
        })
        expect(result.error).toBeUndefined()
      })
    })

    describe('when coordinatesType is "coordinates" and multipleSitesEnabled is true', () => {
      test('Should require siteName when multipleSitesEnabled is true but siteName is missing', () => {
        const result = siteDetailsSchema.validate({
          ...mockSiteDetailsRequest,
          multipleSiteDetails: {
            multipleSitesEnabled: true,
            sameActivityDates: 'yes',
            sameActivityDescription: 'yes'
          },
          siteDetails: [
            {
              ...mockSiteDetailsWithMultiSite[0],
              activityDates: mockSiteDetailsWithMultiSite[0].activityDates,
              siteName: undefined
            }
          ]
        })
        expect(result.error.message).toBe('SITE_NAME_REQUIRED')
      })

      test('Should allow coordinates with siteName when multipleSitesEnabled is true', () => {
        const result = siteDetailsSchema.validate({
          ...mockSiteDetailsRequestWithMultiSite,
          multipleSiteDetails: mockMultipleSiteDetails,
          siteDetails: [
            {
              ...mockSiteDetailsRequestWithMultiSite.siteDetails[0],
              siteName: 'Test Site Name'
            }
          ]
        })
        expect(result.error).toBeUndefined()
      })
    })

    describe('when coordinatesType is "file"', () => {
      test('Should validate siteName when it is present', () => {
        const result = siteDetailsSchema.validate({
          ...mockFileUploadSiteDetailsRequest,
          siteDetails: [
            {
              ...mockFileUploadSiteDetailsRequest.siteDetails[0],
              siteName: ''
            }
          ]
        })
        expect(result.error.message).toBe('SITE_NAME_REQUIRED')
      })

      test('Should allow file upload without siteName', () => {
        const result = siteDetailsSchema.validate(
          mockFileUploadSiteDetailsRequest
        )
        expect(result.error).toBeUndefined()
      })
    })
  })

  describe('#coordinateSystem', () => {
    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], coordinateSystem: 'invalid' }]
      })
      expect(result.error.message).toBe('COORDINATE_SYSTEM_REQUIRED')
    })

    test('Should correctly validate on empty data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], coordinateSystem: null }]
      })
      expect(result.error.message).toBe('COORDINATE_SYSTEM_REQUIRED')
    })
  })

  describe('#width', () => {
    test('Should correctly validate on invalid data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], circleWidth: 'invalid' }]
      })
      expect(result.error.message).toBe('WIDTH_INVALID')
    })

    test('Should correctly validate on empty data', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], circleWidth: null }]
      })

      expect(result.error.message).toBe('WIDTH_REQUIRED')
    })

    test('Should correctly validate when width is below minimum allowed value', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], circleWidth: '0' }]
      })

      expect(result.error.message).toBe('WIDTH_MIN')
    })

    test('Should correctly validate when width is a negative number', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], circleWidth: '-5' }]
      })

      expect(result.error.message).toBe('WIDTH_MIN')
    })

    test('Should correctly validate when width contains incorrect characters', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], circleWidth: 'test' }]
      })

      expect(result.error.message).toBe('WIDTH_INVALID')
    })

    test('Should correctly validate when width is not an integer', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [{ ...mockSiteDetails[0], circleWidth: '12.2' }]
      })

      expect(result.error.message).toBe('WIDTH_NON_INTEGER')
    })
  })

  describe('#coordinates', () => {
    test('Should correctly errors when incorrect coordinates OSGB36', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [
          {
            ...mockSiteDetails[0],
            coordinateSystem: COORDINATE_SYSTEMS.OSGB36
          }
        ]
      })
      expect(result.error.message).toBe('EASTINGS_REQUIRED')
    })

    test('Should correctly errors when incorrect coordinates WGS84', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [
          {
            ...mockSiteDetails[0],
            coordinates: { eastings: '123456', northings: '123456' }
          }
        ]
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
        multipleSiteDetails:
          mockFileUploadSiteDetailsRequest.multipleSiteDetails,
        siteDetails: [
          {
            coordinatesType: 'file',
            activityDates: mockSiteDetailsWithMultiSite[0].activityDates,
            activityDescription:
              mockSiteDetailsWithMultiSite[0].activityDescription,
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
          }
        ],
        id: '68811d2a64a5901f5ea56cb5'
      }

      const result = siteDetailsSchema.validate(productionData)
      expect(result.error).toBeUndefined()
    })

    test('Should reject manual coordinate fields when coordinatesType is file', () => {
      const result = siteDetailsSchema.validate({
        ...mockFileUploadSiteDetailsRequest,
        siteDetails: [
          {
            ...mockFileUploadSiteDetailsRequest.siteDetails[0],
            coordinatesEntry: 'single', // This should be forbidden for file uploads
            coordinateSystem: 'wgs84'
          }
        ]
      })
      expect(result.error.message).toContain('coordinatesEntry')
      expect(result.error.message).toContain('not allowed')
    })

    test('Should reject file upload fields when coordinatesType is coordinates', () => {
      const result = siteDetailsSchema.validate({
        ...mockSiteDetailsRequest,
        siteDetails: [
          {
            ...mockSiteDetails[0],
            fileUploadType: 'kml', // This should be forbidden for manual coordinates
            geoJSON: { type: 'FeatureCollection', features: [] }
          }
        ]
      })
      expect(result.error.message).toContain('fileUploadType')
      expect(result.error.message).toContain('not allowed')
    })

    test('Should require all file upload fields when coordinatesType is file', () => {
      const result = siteDetailsSchema.validate({
        id: mockId,
        multipleSiteDetails:
          mockFileUploadSiteDetailsRequest.multipleSiteDetails,
        siteDetails: [
          {
            coordinatesType: 'file',
            activityDates: mockSiteDetailsWithMultiSite[0].activityDates,
            activityDescription:
              mockSiteDetailsWithMultiSite[0].activityDescription,
            fileUploadType: 'kml',
            s3Location: {
              s3Bucket: 'mmo-uploads',
              s3Key: 'test-file-key',
              checksumSha256: 'test-checksum'
            },
            featureCount: 1
          }
        ]
      })
      expect(result.error.message).toBe('GEO_JSON_REQUIRED')
    })

    const createGeoJSONFeatureTest = (featureOverrides = {}) => ({
      id: mockId,
      multipleSiteDetails: mockFileUploadSiteDetailsRequest.multipleSiteDetails,
      siteDetails: [
        {
          ...mockFileUploadSiteDetailsRequest.siteDetails[0],
          geoJSON: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [-1.2951, 50.7602]
                },
                properties: {},
                ...featureOverrides
              }
            ]
          }
        }
      ]
    })

    test('Should accept GeoJSON features with string id properties', () => {
      const result = siteDetailsSchema.validate(
        createGeoJSONFeatureTest({ id: 'SID12271033' })
      )
      expect(result.error).toBeUndefined()
    })

    test('Should accept GeoJSON features with number id properties', () => {
      const result = siteDetailsSchema.validate(
        createGeoJSONFeatureTest({ id: 12271033 })
      )
      expect(result.error).toBeUndefined()
    })

    test('Should accept GeoJSON features without id properties (backwards compatibility)', () => {
      const result = siteDetailsSchema.validate(createGeoJSONFeatureTest())
      expect(result.error).toBeUndefined()
    })

    test('Should reject GeoJSON features with invalid id types', () => {
      const result = siteDetailsSchema.validate(
        createGeoJSONFeatureTest({ id: { invalid: 'object' } })
      )
      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('id')
    })
  })

  describe('#multiple coordinates validation', () => {
    test('Should correctly validate WGS84 multiple coordinates', () => {
      const result = siteDetailsSchema.validate(
        mockWgs84MultipleCoordinatesRequest
      )
      expect(result.error).toBeUndefined()
    })

    test('Should correctly validate OSGB36 multiple coordinates', () => {
      const result = siteDetailsSchema.validate(
        mockOsgb36MultipleCoordinatesRequest
      )
      expect(result.error).toBeUndefined()
    })

    test('Should reject multiple coordinates with fewer than 3 points', () => {
      const invalidRequest = {
        ...mockWgs84MultipleCoordinatesRequest,
        siteDetails: [
          {
            ...mockWgs84MultipleCoordinatesRequest.siteDetails[0],
            coordinates: [
              { latitude: '54.088594', longitude: '-0.178408' },
              { latitude: '54.086782', longitude: '-0.177369' }
            ]
          }
        ]
      }
      const result = siteDetailsSchema.validate(invalidRequest)
      expect(result.error.message).toBe('COORDINATES_MINIMUM_REQUIRED')
    })

    test('Should reject multiple coordinates with invalid coordinate format', () => {
      const invalidRequest = {
        ...mockWgs84MultipleCoordinatesRequest,
        siteDetails: [
          {
            ...mockWgs84MultipleCoordinatesRequest.siteDetails[0],
            coordinates: [
              { latitude: 'invalid', longitude: '-0.178408' },
              { latitude: '54.086782', longitude: '-0.177369' },
              { latitude: '54.088057', longitude: '-0.175219' }
            ]
          }
        ]
      }
      const result = siteDetailsSchema.validate(invalidRequest)
      expect(result.error.message).toBe('LATITUDE_NON_NUMERIC')
    })

    test('Should reject OSGB36 multiple coordinates with invalid values', () => {
      const invalidRequest = {
        ...mockOsgb36MultipleCoordinatesRequest,
        siteDetails: [
          {
            ...mockOsgb36MultipleCoordinatesRequest.siteDetails[0],
            coordinates: [
              { eastings: '50000', northings: '476895' }, // Below minimum
              { eastings: '514040', northings: '476693' },
              { eastings: '514193', northings: '476835' }
            ]
          }
        ]
      }
      const result = siteDetailsSchema.validate(invalidRequest)
      expect(result.error.message).toBe('EASTINGS_LENGTH')
    })

    test('Should reject multiple coordinates when circleWidth is provided', () => {
      const invalidRequest = {
        ...mockWgs84MultipleCoordinatesRequest,
        siteDetails: [
          {
            ...mockWgs84MultipleCoordinatesRequest.siteDetails[0],
            circleWidth: '20' // Should be forbidden for multiple coordinates
          }
        ]
      }
      const result = siteDetailsSchema.validate(invalidRequest)
      expect(result.error.message).toBe(
        '"siteDetails[0].circleWidth" is not allowed'
      )
    })

    test('Should still require circleWidth for single coordinates', () => {
      const invalidRequest = {
        ...mockSiteDetailsRequest,
        siteDetails: [
          {
            ...mockSiteDetails[0],
            // circleWidth is missing but required for single coordinates
            circleWidth: undefined
          }
        ]
      }
      const result = siteDetailsSchema.validate(invalidRequest)
      expect(result.error.message).toBe('WIDTH_REQUIRED')
    })
  })
})
