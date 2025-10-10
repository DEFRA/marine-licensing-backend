import { vi } from 'vitest'
import { addCreateAuditFields, addUpdateAuditFields } from './mongo-audit.js'
import { getContactId } from '../../api/exemptions/helpers/get-contact-id.js'

vi.mock('../../api/exemptions/helpers/get-contact-id.js')

describe('mongo-audit', () => {
  const mockedGetContactId = vi.mocked(getContactId)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-01-01T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('addCreateAuditFields', () => {
    it('should add all audit fields for create operation', () => {
      const payload = { name: 'Test Project' }
      const auth = { credentials: { contactId: 'user123' } }
      const expectedDate = new Date('2023-01-01T12:00:00.000Z')

      mockedGetContactId.mockReturnValue('user123')

      const result = addCreateAuditFields(auth, payload)

      expect(result).toEqual({
        name: 'Test Project',
        createdAt: expectedDate,
        createdBy: 'user123',
        updatedAt: expectedDate,
        updatedBy: 'user123'
      })
    })

    it('should handle a null payload', () => {
      const auth = { credentials: { contactId: 'user123' } }
      const expectedDate = new Date('2023-01-01T12:00:00.000Z')

      mockedGetContactId.mockReturnValue('user123')

      const result = addCreateAuditFields(auth)

      expect(result).toEqual({
        createdAt: expectedDate,
        createdBy: 'user123',
        updatedAt: expectedDate,
        updatedBy: 'user123'
      })
    })
  })

  describe('addUpdateAuditFields', () => {
    it('should only add updatedAt and updatedBy fields', () => {
      const payload = { name: 'Updated Project' }
      const auth = { credentials: { contactId: 'user456' } }
      const expectedDate = new Date('2023-01-01T12:00:00.000Z')

      mockedGetContactId.mockReturnValue('user456')

      const result = addUpdateAuditFields(auth, payload)

      expect(result).toEqual({
        name: 'Updated Project',
        updatedAt: expectedDate,
        updatedBy: 'user456'
      })
    })

    it('should handle a null payload', () => {
      const auth = { credentials: { contactId: 'user456' } }
      const expectedDate = new Date('2023-01-01T12:00:00.000Z')

      mockedGetContactId.mockReturnValue('user456')

      const result = addUpdateAuditFields(auth)

      expect(result).toEqual({
        updatedAt: expectedDate,
        updatedBy: 'user456'
      })
    })
  })
})
