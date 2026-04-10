import { siteNameFieldSchema } from './site-name.js'

describe('siteNameFieldSchema', () => {
  describe('when siteName is provided', () => {
    it('should validate when siteName is a valid string', () => {
      const result = siteNameFieldSchema.validate('Valid Site Name')
      expect(result.error).toBeUndefined()
      expect(result.value).toBe('Valid Site Name')
    })

    it('should validate when siteName is exactly 250 characters', () => {
      const maxLengthSiteName = 'a'.repeat(250)
      const result = siteNameFieldSchema.validate(maxLengthSiteName)
      expect(result.error).toBeUndefined()
      expect(result.value).toBe(maxLengthSiteName)
    })
  })

  describe('when siteName is not provided', () => {
    it('should fail when siteName is missing', () => {
      const result = siteNameFieldSchema.validate(undefined)
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('SITE_NAME_REQUIRED')
    })

    it('should fail when siteName is null', () => {
      const result = siteNameFieldSchema.validate(null)
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('"value" must be a string')
    })
  })

  describe('when siteName has invalid values', () => {
    it('should fail when siteName is empty string', () => {
      const result = siteNameFieldSchema.validate('')
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('SITE_NAME_REQUIRED')
    })

    it('should fail when siteName is too long', () => {
      const longSiteName = 'a'.repeat(251)
      const result = siteNameFieldSchema.validate(longSiteName)
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('SITE_NAME_MAX_LENGTH')
    })

    it('should fail when siteName is a number', () => {
      const result = siteNameFieldSchema.validate(123)
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('"value" must be a string')
    })

    it('should fail when siteName is an object', () => {
      const result = siteNameFieldSchema.validate({ name: 'test' })
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('"value" must be a string')
    })
  })
})
