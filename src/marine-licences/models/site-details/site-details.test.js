import { siteDetailsSchema } from './site-details.js'

const mockId = 'a'.repeat(24)

const mockWgs84SingleSiteItem = {
  siteName: 'site 1',
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: 'wgs84',
  coordinates: { latitude: '51.507400', longitude: '-0.127800' },
  circleWidth: '50'
}

const mockWgs84MultipleSiteItem = {
  siteName: 'site 1',
  coordinatesType: 'coordinates',
  coordinatesEntry: 'multiple',
  coordinateSystem: 'wgs84',
  coordinates: [
    { latitude: '51.507400', longitude: '-0.127800' },
    { latitude: '51.517500', longitude: '-0.137600' },
    { latitude: '51.527600', longitude: '-0.147700' }
  ]
}

const mockOsgb36SingleSiteItem = {
  siteName: 'site 1',
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: 'osgb36',
  coordinates: { eastings: '530000', northings: '181000' },
  circleWidth: '50'
}

const mockOsgb36MultipleSiteItem = {
  siteName: 'site 1',
  coordinatesType: 'coordinates',
  coordinatesEntry: 'multiple',
  coordinateSystem: 'osgb36',
  coordinates: [
    { easting: '530000', northing: '181000' },
    { easting: '530100', northing: '181100' },
    { easting: '530200', northing: '181200' }
  ]
}

const mockFileUploadSiteItem = {
  coordinatesType: 'file',
  fileUploadType: 'kml',
  geoJSON: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-1.2951, 50.7602] },
        properties: {}
      }
    ]
  },
  featureCount: 1,
  uploadedFile: { filename: 'test.kml' },
  s3Location: {
    s3Bucket: 'mmo-uploads',
    s3Key: 'marine-licences/test-key',
    checksumSha256: 'test-checksum'
  }
}

const mockValidRequest = {
  id: mockId,
  siteDetails: [mockFileUploadSiteItem]
}

describe('#siteDetails schema (marine licences)', () => {
  describe('#siteDetails', () => {
    test('Should correctly validate on valid data', () => {
      const result = siteDetailsSchema.validate(mockValidRequest)
      expect(result.error).toBeUndefined()
    })

    test('Should fail when siteDetails is missing', () => {
      const result = siteDetailsSchema.validate({ id: mockId })
      expect(result.error.message).toBe('SITE_DETAILS_REQUIRED')
    })

    test('Should fail when id is missing', () => {
      const result = siteDetailsSchema.validate({
        siteDetails: [mockFileUploadSiteItem]
      })
      expect(result.error.message).toBe('MARINE_LICENCE_ID_REQUIRED')
    })
  })

  describe('#coordinatesType', () => {
    test('Should fail when coordinatesType is invalid', () => {
      const result = siteDetailsSchema.validate({
        ...mockValidRequest,
        siteDetails: [{ ...mockFileUploadSiteItem, coordinatesType: 'invalid' }]
      })
      expect(result.error.message).toBe('PROVIDE_COORDINATES_CHOICE_REQUIRED')
    })

    test('Should fail when coordinatesType is missing', () => {
      const result = siteDetailsSchema.validate({
        ...mockValidRequest,
        siteDetails: [{ ...mockFileUploadSiteItem, coordinatesType: null }]
      })
      expect(result.error.message).toBe('PROVIDE_COORDINATES_CHOICE_REQUIRED')
    })
  })

  describe('#siteName', () => {
    describe('when coordinatesType is "file"', () => {
      test('Should allow siteName to be absent', () => {
        const result = siteDetailsSchema.validate(mockValidRequest)
        expect(result.error).toBeUndefined()
      })

      test('Should allow siteName when provided', () => {
        const result = siteDetailsSchema.validate({
          ...mockValidRequest,
          siteDetails: [
            { ...mockFileUploadSiteItem, siteName: 'Test Site Name' }
          ]
        })
        expect(result.error).toBeUndefined()
      })

      test('Should fail when siteName is an empty string', () => {
        const result = siteDetailsSchema.validate({
          ...mockValidRequest,
          siteDetails: [{ ...mockFileUploadSiteItem, siteName: '' }]
        })
        expect(result.error.message).toBe('SITE_NAME_REQUIRED')
      })

      test('Should fail when siteName exceeds max length', () => {
        const result = siteDetailsSchema.validate({
          ...mockValidRequest,
          siteDetails: [
            { ...mockFileUploadSiteItem, siteName: 'a'.repeat(251) }
          ]
        })
        expect(result.error.message).toBe('SITE_NAME_MAX_LENGTH')
      })
    })

    describe('when coordinatesType is "coordinates"', () => {
      test('Should not allow siteName field to be absent', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [
            {
              coordinatesType: 'coordinates'
            }
          ]
        })
        expect(result.error.message).toContain('SITE_NAME_REQUIRED')
      })
    })
  })

  describe('#manual coordinates', () => {
    describe('WGS84 single (centre point)', () => {
      test('Should correctly validate valid data', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [mockWgs84SingleSiteItem]
        })
        expect(result.error).toBeUndefined()
      })

      test('Should fail when coordinatesEntry is missing', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [
            {
              siteName: 'site 1',
              coordinatesType: 'coordinates',
              coordinateSystem: 'wgs84',
              coordinates: mockWgs84SingleSiteItem.coordinates,
              circleWidth: '50'
            }
          ]
        })
        expect(result.error.message).toBe('COORDINATES_ENTRY_REQUIRED')
      })

      test('Should fail when coordinateSystem is missing', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [
            {
              siteName: 'site 1',
              coordinatesType: 'coordinates',
              coordinatesEntry: 'single',
              coordinates: mockWgs84SingleSiteItem.coordinates,
              circleWidth: '50'
            }
          ]
        })
        expect(result.error.message).toBe('COORDINATE_SYSTEM_REQUIRED')
      })
    })

    describe('WGS84 multiple (polygon)', () => {
      test('Should correctly validate valid data', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [mockWgs84MultipleSiteItem]
        })
        expect(result.error).toBeUndefined()
      })

      test('Should fail when fewer than 3 coordinate points are provided', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [
            {
              ...mockWgs84MultipleSiteItem,
              coordinates: [
                { latitude: '51.507400', longitude: '-0.127800' },
                { latitude: '51.517500', longitude: '-0.137600' }
              ]
            }
          ]
        })
        expect(result.error.message).toBe('COORDINATES_MINIMUM_REQUIRED')
      })

      test('Should fail when circleWidth is provided for multiple entry', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [{ ...mockWgs84MultipleSiteItem, circleWidth: '50' }]
        })
        expect(result.error.message).toContain('not allowed')
      })
    })

    describe('OSGB36 single (centre point)', () => {
      test('Should correctly validate valid data', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [mockOsgb36SingleSiteItem]
        })
        expect(result.error).toBeUndefined()
      })
    })

    describe('OSGB36 multiple (polygon)', () => {
      test('Should correctly validate valid data with singular field names', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [mockOsgb36MultipleSiteItem]
        })
        expect(result.error).toBeUndefined()
      })

      test('Should fail when easting is non-numeric', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [
            {
              ...mockOsgb36MultipleSiteItem,
              coordinates: [
                { easting: 'abc', northing: '181000' },
                { easting: '530100', northing: '181100' },
                { easting: '530200', northing: '181200' }
              ]
            }
          ]
        })
        expect(result.error.message).toContain('EASTING_NON_NUMERIC')
      })

      test('Should fail when northing is negative', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [
            {
              ...mockOsgb36MultipleSiteItem,
              coordinates: [
                { easting: '530000', northing: '-1' },
                { easting: '530100', northing: '181100' },
                { easting: '530200', northing: '181200' }
              ]
            }
          ]
        })
        expect(result.error.message).toContain('NORTHING_POSITIVE_NUMBER')
      })

      test('Should fail when fewer than 3 points are provided', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [
            {
              ...mockOsgb36MultipleSiteItem,
              coordinates: [
                { easting: '530000', northing: '181000' },
                { easting: '530100', northing: '181100' }
              ]
            }
          ]
        })
        expect(result.error.message).toBe('COORDINATES_MINIMUM_REQUIRED')
      })
    })
  })
})
