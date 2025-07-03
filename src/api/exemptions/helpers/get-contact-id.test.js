import { getContactId } from './get-contact-id.js'
import Boom from '@hapi/boom'
import { config } from '../../../config.js'

jest.mock('../../../config.js')

describe('getContactId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    config.get.mockReturnValue({
      authEnabled: true
    })
  })

  describe('when auth is enabled', () => {
    it('returns contactId if present', () => {
      const auth = { credentials: { contactId: '123' } }
      expect(getContactId(auth)).toBe('123')
    })

    it('throws 401 if credentials is missing', () => {
      expect(() => getContactId({})).toThrow(
        Boom.unauthorized('User not authenticated')
      )
    })

    it('throws 401 if contactId is missing', () => {
      expect(() => getContactId({ credentials: {} })).toThrow(
        Boom.unauthorized('User not authenticated')
      )
    })
  })

  describe('when auth is disabled', () => {
    beforeEach(() => {
      config.get.mockReturnValue({
        authEnabled: false
      })
    })

    it('returns empty string when auth is disabled, even with valid credentials', () => {
      const auth = { credentials: { contactId: '123' } }
      expect(getContactId(auth)).toBe('')
    })

    it('returns empty string when auth is disabled and credentials are missing', () => {
      expect(getContactId({})).toBe('')
    })

    it('returns empty string when auth is disabled and contactId is missing', () => {
      expect(() => getContactId({ credentials: {} })).not.toThrow()
      expect(getContactId({ credentials: {} })).toBe('')
    })

    it('returns empty string when auth is disabled and auth is undefined', () => {
      expect(getContactId(undefined)).toBe('')
    })
  })
})
