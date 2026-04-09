import { siteDetailsSchema } from './site-details.js'

const mockId = 'a'.repeat(24)

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
      test('Should not allow siteName field to be present', () => {
        const result = siteDetailsSchema.validate({
          id: mockId,
          siteDetails: [
            {
              coordinatesType: 'coordinates',
              siteName: 'Test Site Name'
            }
          ]
        })
        expect(result.error.message).toContain('"siteDetails[0].siteName"')
        expect(result.error.message).toContain('not allowed')
      })
    })
  })
})
