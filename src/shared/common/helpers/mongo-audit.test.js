import { vi } from 'vitest'
import {
  addCreateAuditFields,
  addCreateAuditFieldsOptional,
  addUpdateAuditFields,
  addUpdateAuditFieldsOptional
} from './mongo-audit.js'
import {
  getContactId,
  getOptionalContactId
} from '../../helpers/get-contact-id.js'

vi.mock('../../helpers/get-contact-id.js')

describe('mongo-audit', () => {
  const mockedGetContactId = vi.mocked(getContactId)
  const mockedGetOptionalContactId = vi.mocked(getOptionalContactId)

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

  describe('addCreateAuditFieldsOptional', () => {
    it('stamps createdAt/updatedAt and null createdBy/updatedBy when anonymous', () => {
      mockedGetOptionalContactId.mockReturnValue(null)

      const result = addCreateAuditFieldsOptional(undefined, { foo: 'bar' })

      expect(result.foo).toBe('bar')
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
      expect(result.createdBy).toBeNull()
      expect(result.updatedBy).toBeNull()
    })

    it('uses contactId when authenticated', () => {
      mockedGetOptionalContactId.mockReturnValue('user-1')

      const auth = { credentials: { contactId: 'user-1' } }
      const result = addCreateAuditFieldsOptional(auth, { foo: 'bar' })

      expect(result.createdBy).toBe('user-1')
      expect(result.updatedBy).toBe('user-1')
    })
  })

  describe('addUpdateAuditFieldsOptional', () => {
    it('bumps updatedAt and null updatedBy when anonymous, leaves createdAt alone', () => {
      mockedGetOptionalContactId.mockReturnValue(null)

      const result = addUpdateAuditFieldsOptional(undefined, { foo: 'bar' })

      expect(result.foo).toBe('bar')
      expect(result.updatedAt).toBeInstanceOf(Date)
      expect(result.updatedBy).toBeNull()
      expect(result.createdAt).toBeUndefined()
      expect(result.createdBy).toBeUndefined()
    })

    it('uses contactId when authenticated', () => {
      mockedGetOptionalContactId.mockReturnValue('user-2')

      const auth = { credentials: { contactId: 'user-2' } }
      const result = addUpdateAuditFieldsOptional(auth, { foo: 'bar' })

      expect(result.updatedBy).toBe('user-2')
    })
  })
})
