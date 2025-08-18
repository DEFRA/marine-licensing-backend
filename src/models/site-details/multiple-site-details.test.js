import { multipleSiteDetailsSchema } from './multiple-site-details.js'

describe('multipleSiteDetailsSchema', () => {
  describe('when multipleSitesEnabled is provided', () => {
    it('should validate when multipleSitesEnabled is true', () => {
      const result = multipleSiteDetailsSchema.validate({
        multipleSitesEnabled: true
      })

      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({
        multipleSitesEnabled: true
      })
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
      expect(result.error.message).toContain(
        '"multipleSitesEnabled" must be a boolean'
      )
    })

    it('should fail when multipleSitesEnabled is a number', () => {
      const result = multipleSiteDetailsSchema.validate({
        multipleSitesEnabled: 1
      })

      expect(result.error.message).toContain(
        '"multipleSitesEnabled" must be a boolean'
      )
    })

    it('should fail when multipleSitesEnabled is null', () => {
      const result = multipleSiteDetailsSchema.validate({
        multipleSitesEnabled: null
      })

      expect(result.error.message).toContain(
        '"multipleSitesEnabled" must be a boolean'
      )
    })
  })
})
