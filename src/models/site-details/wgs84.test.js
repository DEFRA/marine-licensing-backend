import { mockSiteDetails } from './test-fixtures.js'
import { wgs84ValidationSchema } from './wgs84.js'

describe('#centreCoordinate models', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('#wgs84ValidationSchema model', () => {
    test('Should correctly validate on valid data', () => {
      const request = {
        latitude: mockSiteDetails[0].coordinates.latitude,
        longitude: mockSiteDetails[0].coordinates.longitude
      }

      const result = wgs84ValidationSchema.validate(request)

      expect(result.error).toBeUndefined()
    })

    test('Should correctly validate on empty data', () => {
      const request = {}

      const result = wgs84ValidationSchema.validate(request, {
        abortEarly: false
      })

      expect(result.error.message).toContain('LATITUDE_REQUIRED')
      expect(result.error.message).toContain('LONGITUDE_REQUIRED')
    })

    test('Should correctly validate when latitude and longitude are empty strings', () => {
      const request = {
        latitude: '',
        longitude: ''
      }

      const result = wgs84ValidationSchema.validate(request, {
        abortEarly: false
      })

      expect(result.error.message).toContain('LATITUDE_REQUIRED')
      expect(result.error.message).toContain('LONGITUDE_REQUIRED')
    })

    test('Should correctly validate when latitude and longitude is below minimum allowed value', () => {
      const request = {
        latitude: '-91',
        longitude: '-181'
      }

      const result = wgs84ValidationSchema.validate(request, {
        abortEarly: false
      })

      expect(result.error.message).toContain('LATITUDE_LENGTH')
      expect(result.error.message).toContain('LONGITUDE_LENGTH')
    })

    test('Should correctly validate when latitude and longitude is above maximum allowed value', () => {
      const request = {
        latitude: '91',
        longitude: '181'
      }

      const result = wgs84ValidationSchema.validate(request, {
        abortEarly: false
      })

      expect(result.error.message).toContain('LATITUDE_LENGTH')
      expect(result.error.message).toContain('LONGITUDE_LENGTH')
    })

    test('Should correctly validate when latitude and longitude have incorrect characters', () => {
      const request = {
        latitude: '-9/',
        longitude: '-18/'
      }

      const result = wgs84ValidationSchema.validate(request, {
        abortEarly: false
      })

      expect(result.error.message).toContain('LATITUDE_NON_NUMERIC')
      expect(result.error.message).toContain('LONGITUDE_NON_NUMERIC')
    })

    test('Should correctly validate eastings and northing do not have correct decimal places', () => {
      const request = {
        latitude: '50.12345',
        longitude: '50.12345'
      }

      const result = wgs84ValidationSchema.validate(request, {
        abortEarly: false
      })

      expect(result.error.message).toContain('LATITUDE_DECIMAL_PLACES')
      expect(result.error.message).toContain('LONGITUDE_DECIMAL_PLACES')
    })
  })
})
