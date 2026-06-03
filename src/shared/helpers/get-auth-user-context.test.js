import { describe, it, expect } from 'vitest'
import { getAuthUserContext } from './get-auth-user-context.js'

const applicantRequest = {
  auth: {
    artifacts: { decoded: { sub: 'user-id' } },
    credentials: { contactId: 'contact-123' },
    token: 'defra-token',
    relationships: ['rel-id:org-id:Org Name:0:Employee:0']
  }
}

const entraRequest = {
  auth: {
    artifacts: { decoded: { tid: 'tenant-id' } },
    credentials: {}
  }
}

describe('getAuthUserContext', () => {
  it('returns currentUserId for an applicant user', () => {
    const result = getAuthUserContext(applicantRequest)
    expect(result.currentUserId).toBe('contact-123')
  })

  it('returns null currentUserId for an Entra ID user', () => {
    const result = getAuthUserContext(entraRequest)
    expect(result.currentUserId).toBeNull()
  })

  it('returns null currentOrganisationId for an Entra ID user', () => {
    const result = getAuthUserContext(entraRequest)
    expect(result.currentOrganisationId).toBeNull()
  })

  it('throws a forbidden error when there is no decoded token', () => {
    expect(() => getAuthUserContext({ auth: {} })).toThrow(
      'Not authorised to request this resource'
    )
  })
})
