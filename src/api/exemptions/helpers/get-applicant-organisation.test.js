import { getApplicantOrganisationId } from './get-applicant-organisation.js'

describe('getApplicantOrganisationId', () => {
  it('should return null when auth is null', () => {
    const result = getApplicantOrganisationId(null)
    expect(result).toBeNull()
  })

  it('should return null when auth is undefined', () => {
    const result = getApplicantOrganisationId(undefined)
    expect(result).toBeNull()
  })

  it('should return null when artifacts is undefined', () => {
    const auth = {}
    const result = getApplicantOrganisationId(auth)
    expect(result).toBeNull()
  })

  it('should return null when decoded is undefined', () => {
    const auth = {
      artifacts: {}
    }
    const result = getApplicantOrganisationId(auth)
    expect(result).toBeNull()
  })

  it('should return null when relationships is undefined', () => {
    const auth = {
      artifacts: {
        decoded: {}
      }
    }
    const result = getApplicantOrganisationId(auth)
    expect(result).toBeNull()
  })

  it('should return null when relationships is empty array', () => {
    const auth = {
      artifacts: {
        decoded: {
          relationships: []
        }
      }
    }
    const result = getApplicantOrganisationId(auth)
    expect(result).toBeNull()
  })

  it('should return null when first relationship does not contain colon', () => {
    const auth = {
      artifacts: {
        decoded: {
          relationships: ['invalid-relationship']
        }
      }
    }
    const result = getApplicantOrganisationId(auth)
    expect(result).toBeNull()
  })

  it('should return null when first relationship has only one part', () => {
    const auth = {
      artifacts: {
        decoded: {
          relationships: ['relationship:']
        }
      }
    }
    const result = getApplicantOrganisationId(auth)
    expect(result).toBeNull()
  })

  it('should return applicant organisation ID when valid relationship exists', () => {
    const auth = {
      artifacts: {
        decoded: {
          relationships: ['relationship-id:org-123']
        }
      }
    }
    const result = getApplicantOrganisationId(auth)
    expect(result).toBe('org-123')
  })

  it('should return first applicant organisation ID when multiple relationships exist', () => {
    const auth = {
      artifacts: {
        decoded: {
          relationships: ['relationship-1:org-123', 'relationship-2:org-456']
        }
      }
    }
    const result = getApplicantOrganisationId(auth)
    expect(result).toBe('org-123')
  })

  it('should handle complex organisation ID format', () => {
    const auth = {
      artifacts: {
        decoded: {
          relationships: ['rel-id:complex-org-id-with-dashes-123']
        }
      }
    }
    const result = getApplicantOrganisationId(auth)
    expect(result).toBe('complex-org-id-with-dashes-123')
  })
})
