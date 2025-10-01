import { getContactId } from './get-contact-id.js'
import Boom from '@hapi/boom'

describe('getContactId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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
