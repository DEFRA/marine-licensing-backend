import { getContactId, getOptionalContactId } from './get-contact-id.js'
import Boom from '@hapi/boom'

describe('getContactId', () => {
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

describe('getOptionalContactId', () => {
  it('returns the contactId when present', () => {
    expect(
      getOptionalContactId({ credentials: { contactId: 'user-123' } })
    ).toBe('user-123')
  })

  it('returns null when auth is undefined', () => {
    expect(getOptionalContactId(undefined)).toBeNull()
  })

  it('returns null when credentials is missing', () => {
    expect(getOptionalContactId({})).toBeNull()
  })

  it('returns null when contactId is missing', () => {
    expect(getOptionalContactId({ credentials: {} })).toBeNull()
  })
})
