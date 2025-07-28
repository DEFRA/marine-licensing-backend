import { addCreateAuditFields, addUpdateAuditFields } from './mongo-audit.js'
import { getContactId } from '../../api/exemptions/helpers/get-contact-id.js'

jest.mock('../../api/exemptions/helpers/get-contact-id.js')

describe('mongo-audit', () => {
  const mockedGetContactId = jest.mocked(getContactId)

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2023-01-01T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
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
      const payload = {}
      const auth = { credentials: { contactId: 'user123' } }
      const expectedDate = new Date('2023-01-01T12:00:00.000Z')

      mockedGetContactId.mockReturnValue('user123')

      const result = addCreateAuditFields(auth, payload)

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
      const payload = {}
      const auth = { credentials: { contactId: 'user456' } }
      const expectedDate = new Date('2023-01-01T12:00:00.000Z')

      mockedGetContactId.mockReturnValue('user456')

      const result = addUpdateAuditFields(auth, payload)

      expect(result).toEqual({
        updatedAt: expectedDate,
        updatedBy: 'user456'
      })
    })
  })
})
