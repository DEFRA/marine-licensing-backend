import { describe, it, expect } from 'vitest'
import { isEntraIdUser } from './is-entra-id-user.js'

describe('isEntraIdUser', () => {
  it('returns true when the decoded JWT is Entra ID user', () => {
    const request = { auth: { artifacts: { decoded: { tid: 'tenant-id' } } } }
    expect(isEntraIdUser(request)).toBe(true)
  })

  it('returns false when the decoded JWT is an applicant user', () => {
    const request = { auth: { artifacts: { decoded: { sub: 'user-id' } } } }
    expect(isEntraIdUser(request)).toBe(false)
  })

  it('returns false when auth artifacts are missing', () => {
    const request = { auth: {} }
    expect(isEntraIdUser(request)).toBe(false)
  })
})
