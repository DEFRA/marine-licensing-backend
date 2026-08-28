import { getProjects } from './get-projects.js'

describe('getProjects validation schema', () => {
  describe('empty payload', () => {
    it('should accept an empty object', () => {
      const result = getProjects.validate({})

      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({})
    })
  })

  describe('show param validation', () => {
    it.each(['all-projects', 'my-projects'])(
      'should accept show: %s',
      (show) => {
        const result = getProjects.validate({ show })

        expect(result.error).toBeUndefined()
        expect(result.value.show).toBe(show)
      }
    )

    it('should not require show', () => {
      const result = getProjects.validate({})

      expect(result.error).toBeUndefined()
      expect(result.value.show).toBeUndefined()
    })

    it('should reject an unrecognised show value', () => {
      const result = getProjects.validate({ show: 'not-a-valid-value' })

      expect(result.error).toBeDefined()
    })
  })

  describe('unknown fields', () => {
    it('should reject payloads with fields not in the schema', () => {
      const result = getProjects.validate({ extraField: 'not allowed' })

      expect(result.error).toBeDefined()
    })
  })
})
