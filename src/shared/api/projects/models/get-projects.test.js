import { getProjects } from './get-projects.js'
import { EXEMPTION_STATUS } from '../../../../exemptions/constants/exemption.js'
import { MARINE_LICENCE_STATUS } from '../../../../marine-licences/constants/marine-licence.js'

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

  describe('status param validation', () => {
    it.each([
      ...Object.values(EXEMPTION_STATUS),
      ...Object.values(MARINE_LICENCE_STATUS)
    ])(
      'should accept and wrap a single status checkbox value: %s',
      (singleStatus) => {
        const result = getProjects.validate({ status: singleStatus })

        expect(result.error).toBeUndefined()
        expect(result.value.status).toEqual([singleStatus])
      }
    )

    it('should accept multiple status values from checkboxes', () => {
      const result = getProjects.validate({
        status: [EXEMPTION_STATUS.DRAFT, MARINE_LICENCE_STATUS.SUBMITTED]
      })

      expect(result.error).toBeUndefined()
      expect(result.value.status).toEqual([
        EXEMPTION_STATUS.DRAFT,
        MARINE_LICENCE_STATUS.SUBMITTED
      ])
    })

    it('should not require status', () => {
      const result = getProjects.validate({})

      expect(result.error).toBeUndefined()
      expect(result.value.status).toBeUndefined()
    })

    it('should accept a single status value already wrapped in an array', () => {
      const result = getProjects.validate({
        status: [EXEMPTION_STATUS.ACTIVE]
      })

      expect(result.error).toBeUndefined()
      expect(result.value.status).toEqual([EXEMPTION_STATUS.ACTIVE])
    })

    it('should reject an unrecognised status value', () => {
      const result = getProjects.validate({ status: 'NOT_A_REAL_STATUS' })

      expect(result.error).toBeDefined()
    })

    it('should reject an array containing an unrecognised status value', () => {
      const result = getProjects.validate({
        status: [EXEMPTION_STATUS.DRAFT, 'NOT_A_REAL_STATUS']
      })

      expect(result.error).toBeDefined()
    })
  })

  describe('type param validation', () => {
    it.each(['exemptions', 'marine-licence'])(
      'should accept and wrap a single type value: %s',
      (singleType) => {
        const result = getProjects.validate({ type: singleType })

        expect(result.error).toBeUndefined()
        expect(result.value.type).toEqual([singleType])
      }
    )

    it('should accept multiple type values', () => {
      const result = getProjects.validate({
        type: ['exemptions', 'marine-licence']
      })

      expect(result.error).toBeUndefined()
      expect(result.value.type).toEqual(['exemptions', 'marine-licence'])
    })

    it('should not require type', () => {
      const result = getProjects.validate({})

      expect(result.error).toBeUndefined()
      expect(result.value.type).toBeUndefined()
    })

    it('should accept a single type value already wrapped in an array', () => {
      const result = getProjects.validate({ type: ['exemptions'] })

      expect(result.error).toBeUndefined()
      expect(result.value.type).toEqual(['exemptions'])
    })

    it('should reject an unrecognised type value', () => {
      const result = getProjects.validate({ type: 'not-a-valid-value' })

      expect(result.error).toBeDefined()
    })

    it('should reject an array containing an unrecognised type value', () => {
      const result = getProjects.validate({
        type: ['exemptions', 'not-a-valid-value']
      })

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
