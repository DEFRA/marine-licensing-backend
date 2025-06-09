import { ObjectId } from 'mongodb'
import { siteDetailsSchema } from './site-details.js'
import { COORDINATE_SYSTEMS } from '../../common/constants/coordinates.js'

const mockId = new ObjectId().toHexString()
const mockSiteDetails = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: COORDINATE_SYSTEMS.WGS84
}
export const mockSiteDetailsRequest = {
  id: mockId,
  siteDetails: mockSiteDetails
}

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
})
