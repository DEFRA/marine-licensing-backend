import { getProjects } from './get-projects.js'
import { EXEMPTION_STATUS } from '../../../../exemptions/constants/exemption.js'
import { MARINE_LICENCE_STATUS } from '../../../../marine-licences/constants/marine-licence.js'

describe('getProjects validation schema', () => {
  describe('empty payload', () => {
    it('should accept an empty object', () => {
      const result = getProjects.validate({})

      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({ skipUsers: false })
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

  describe('user param validation', () => {
    const VALID_UUID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
    const OTHER_VALID_UUID = 'e2c1a2a0-6b1a-4c1a-8b1a-6b1a4c1a8b1a'

    it('should accept a single value', () => {
      const result = getProjects.validate({
        show: 'specific-user',
        user: VALID_UUID
      })

      expect(result.error).toBeUndefined()
      expect(result.value.user).toEqual([VALID_UUID])
    })

    it('should accept multiple user values from checkboxes', () => {
      const result = getProjects.validate({
        show: 'specific-user',
        user: [VALID_UUID, OTHER_VALID_UUID]
      })

      expect(result.error).toBeUndefined()
      expect(result.value.user).toEqual([VALID_UUID, OTHER_VALID_UUID])
    })

    it('should accept specific-user without a user (none checked)', () => {
      const result = getProjects.validate({ show: 'specific-user' })

      expect(result.error).toBeUndefined()
      expect(result.value.user).toBeUndefined()
    })

    it('should accept specific-user with an empty user array', () => {
      const result = getProjects.validate({
        show: 'specific-user',
        user: []
      })

      expect(result.error).toBeUndefined()
      expect(result.value.user).toEqual([])
    })

    it('should reject an array containing an unrecognised user value', () => {
      const result = getProjects.validate({
        show: 'specific-user',
        user: [VALID_UUID, 'not-a-uuid']
      })

      expect(result.error).toBeDefined()
    })

    it.each(['all-projects', 'my-projects'])(
      'should reject a user field when show: %s',
      (show) => {
        const result = getProjects.validate({ show, user: VALID_UUID })

        expect(result.error).toBeDefined()
      }
    )

    it('should reject a user field when show is not set', () => {
      const result = getProjects.validate({ user: VALID_UUID })

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
    it.each(['exemption', 'marine-licence'])(
      'should accept and wrap a single type value: %s',
      (singleType) => {
        const result = getProjects.validate({ type: singleType })

        expect(result.error).toBeUndefined()
        expect(result.value.type).toEqual([singleType])
      }
    )

    it('should accept multiple type values', () => {
      const result = getProjects.validate({
        type: ['exemption', 'marine-licence']
      })

      expect(result.error).toBeUndefined()
      expect(result.value.type).toEqual(['exemption', 'marine-licence'])
    })

    it('should not require type', () => {
      const result = getProjects.validate({})

      expect(result.error).toBeUndefined()
      expect(result.value.type).toBeUndefined()
    })

    it('should accept a single type value already wrapped in an array', () => {
      const result = getProjects.validate({ type: ['exemption'] })

      expect(result.error).toBeUndefined()
      expect(result.value.type).toEqual(['exemption'])
    })

    it('should reject an unrecognised type value', () => {
      const result = getProjects.validate({ type: 'not-a-valid-value' })

      expect(result.error).toBeDefined()
    })

    it('should reject an array containing an unrecognised type value', () => {
      const result = getProjects.validate({
        type: ['exemption', 'not-a-valid-value']
      })

      expect(result.error).toBeDefined()
    })
  })

  describe('skipUsers validation', () => {
    it('should default to false when omitted', () => {
      const result = getProjects.validate({})

      expect(result.error).toBeUndefined()
      expect(result.value.skipUsers).toBe(false)
    })

    it.each([true, false])(
      'should accept an explicit boolean: %s',
      (skipUsers) => {
        const result = getProjects.validate({ skipUsers })

        expect(result.error).toBeUndefined()
        expect(result.value.skipUsers).toBe(skipUsers)
      }
    )

    it('should reject a non-boolean value', () => {
      const result = getProjects.validate({ skipUsers: 'yes' })
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
