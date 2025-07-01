import { getUserId } from './get-user-id.js'
import Boom from '@hapi/boom'

describe('getUserId', () => {
  it('returns userId if present', () => {
    const auth = { credentials: { userId: '123' } }
    expect(getUserId(auth)).toBe('123')
  })

  it('throws 401 if credentials is missing', () => {
    expect(() => getUserId({})).toThrow(
      Boom.unauthorized('User not authenticated')
    )
  })

  it('throws 401 if userId is missing', () => {
    expect(() => getUserId({ credentials: {} })).toThrow(
      Boom.unauthorized('User not authenticated')
    )
  })
})
