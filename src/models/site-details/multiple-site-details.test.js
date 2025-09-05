import { multipleSiteDetailsSchema } from './multiple-site-details.js'
import { mockMultipleSiteDetails } from './test-fixtures.js'

describe('multipleSiteDetailsSchema', () => {
  describe('#multipleSitesEnabled', () => {
    describe('when multipleSitesEnabled is provided', () => {
      it('should validate when multipleSitesEnabled is true', () => {
        const result = multipleSiteDetailsSchema.validate(
          mockMultipleSiteDetails
        )

        expect(result.error).toBeUndefined()
        expect(result.value).toEqual(mockMultipleSiteDetails)
      })

      it('should validate when multipleSitesEnabled is false', () => {
        const result = multipleSiteDetailsSchema.validate({
          multipleSitesEnabled: false
        })

        expect(result.error).toBeUndefined()
        expect(result.value).toEqual({
          multipleSitesEnabled: false
        })
      })
    })

    describe('when multipleSitesEnabled is not provided', () => {
      it('should default multipleSitesEnabled to false', () => {
        const result = multipleSiteDetailsSchema.validate({})

        expect(result.error).toBeUndefined()
        expect(result.value).toEqual({
          multipleSitesEnabled: false
        })
      })
    })

    describe('when multipleSitesEnabled has invalid values', () => {
      it('should fail when multipleSitesEnabled is a string', () => {
        const result = multipleSiteDetailsSchema.validate({
          multipleSitesEnabled: 'maybe'
        })

        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('MULTIPLE_SITES_REQUIRED')
      })

      it('should fail when multipleSitesEnabled is a number', () => {
        const result = multipleSiteDetailsSchema.validate({
          multipleSitesEnabled: 1
        })

        expect(result.error.message).toContain('MULTIPLE_SITES_REQUIRED')
      })

      it('should fail when multipleSitesEnabled is null', () => {
        const result = multipleSiteDetailsSchema.validate({
          multipleSitesEnabled: null
        })

        expect(result.error.message).toContain('MULTIPLE_SITES_REQUIRED')
      })
    })
  })
  describe('#sameActivityDates', () => {
    it('should fail when sameActivityDates is missing', () => {
      const result = multipleSiteDetailsSchema.validate({
        multipleSitesEnabled: true
      })

      expect(result.error.message).toContain('SAME_ACTIVITY_DATES_REQUIRED')
    })

    it('should fail when sameActivityDates is undefined', () => {
      const result = multipleSiteDetailsSchema.validate({
        ...mockMultipleSiteDetails,
        sameActivityDates: undefined
      })

      expect(result.error.message).toContain('SAME_ACTIVITY_DATES_REQUIRED')
    })

    it('should fail when sameActivityDates is invalid value', () => {
      const result = multipleSiteDetailsSchema.validate({
        ...mockMultipleSiteDetails,
        sameActivityDates: 'invalid'
      })

      expect(result.error.message).toContain('SAME_ACTIVITY_DATES_REQUIRED')
    })

    it('should validate when sameActivityDates is valid value', () => {
      const result = multipleSiteDetailsSchema.validate(mockMultipleSiteDetails)

      expect(result.error).toBeUndefined()
    })
  })
  describe('#sameActivityDescription', () => {
    it('should fail when sameActivityDescription is missing', () => {
      const result = multipleSiteDetailsSchema.validate({
        multipleSitesEnabled: true,
        sameActivityDates: 'yes'
      })

      expect(result.error.message).toContain(
        'SAME_ACTIVITY_DESCRIPTION_REQUIRED'
      )
    })

    it('should fail when sameActivityDescription is undefined', () => {
      const result = multipleSiteDetailsSchema.validate({
        ...mockMultipleSiteDetails,
        sameActivityDescription: undefined
      })

      expect(result.error.message).toContain(
        'SAME_ACTIVITY_DESCRIPTION_REQUIRED'
      )
    })

    it('should fail when sameActivityDescription is invalid value', () => {
      const result = multipleSiteDetailsSchema.validate({
        ...mockMultipleSiteDetails,
        sameActivityDescription: 'invalid'
      })

      expect(result.error.message).toContain(
        'SAME_ACTIVITY_DESCRIPTION_REQUIRED'
      )
    })

    it('should validate when sameActivityDescription is valid value', () => {
      const result = multipleSiteDetailsSchema.validate(mockMultipleSiteDetails)

      expect(result.error).toBeUndefined()
    })
  })
})
