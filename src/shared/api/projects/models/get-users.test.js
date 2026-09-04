import { getUsers } from './get-users.js'
import { randomUUID } from 'node:crypto'

describe('getUsers validation schema', () => {
  const VALID_UUID = randomUUID()
  const OTHER_VALID_UUID = randomUUID()

  describe('contactIds validation', () => {
    it('should reject invalid format', () => {
      const result = getUsers.validate({})

      expect(result.error).toBeDefined()
    })

    it('should reject an array containing a non-uuid item', () => {
      const result = getUsers.validate({
        contactIds: [VALID_UUID, 'not-a-uuid']
      })

      expect(result.error).toBeDefined()
    })

    it('should accept a single-item array', () => {
      const result = getUsers.validate({ contactIds: [VALID_UUID] })

      expect(result.error).toBeUndefined()
      expect(result.value.contactIds).toEqual([VALID_UUID])
    })

    it('should accept a multi-item array', () => {
      const result = getUsers.validate({
        contactIds: [VALID_UUID, OTHER_VALID_UUID]
      })

      expect(result.error).toBeUndefined()
      expect(result.value.contactIds).toEqual([VALID_UUID, OTHER_VALID_UUID])
    })
  })

  describe('unknown fields', () => {
    it('should reject payloads with fields not in the schema', () => {
      const result = getUsers.validate({
        contactIds: [VALID_UUID],
        extraField: 'not allowed'
      })

      expect(result.error).toBeDefined()
    })
  })
})
