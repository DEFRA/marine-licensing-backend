import { waterFrameworkDirectiveSchema } from './water-framework-directive.js'

describe('waterFrameworkDirective', () => {
  const validId = 'a'.repeat(24)

  describe('waterFrameworkDirective object', () => {
    test('should fail if waterFrameworkDirective object is missing', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({ id: validId })
      expect(error.message).toContain('WATER_FRAMEWORK_DIRECTIVE_REQUIRED')
    })
  })

  describe('nauticalMile', () => {
    test('should pass with yes', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: { nauticalMile: 'yes' }
      })
      expect(error).toBeUndefined()
    })

    test('should pass with no', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: { nauticalMile: 'no' }
      })
      expect(error).toBeUndefined()
    })

    test('should fail if missing', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {}
      })
      expect(error.message).toContain('NAUTICAL_MILE_REQUIRED')
    })

    test('should fail if not a valid value', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: { nauticalMile: 'maybe' }
      })
      expect(error.message).toContain('NAUTICAL_MILE_REQUIRED')
    })

    test('should fail if empty string', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: { nauticalMile: '' }
      })
      expect(error.message).toContain('NAUTICAL_MILE_REQUIRED')
    })
  })
})
