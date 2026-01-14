import {
  getOrganisationIdFromAuthToken,
  getOrganisationDetailsFromAuthToken
} from './get-organisation-from-token.js'

describe('getOrganisationIdFromAuthToken', () => {
  describe('Error handling', () => {
    it('should return null when auth is null', () => {
      const result = getOrganisationIdFromAuthToken(null)
      expect(result).toBeNull()
    })

    it('should return null when auth is undefined', () => {
      const result = getOrganisationIdFromAuthToken(undefined)
      expect(result).toBeNull()
    })

    it('should return null when artifacts is undefined', () => {
      const auth = {}
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBeNull()
    })

    it('should return null when decoded is undefined', () => {
      const auth = {
        artifacts: {}
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBeNull()
    })

    it('should return null when currentRelationshipId is missing', () => {
      const auth = {
        artifacts: {
          decoded: {}
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBeNull()
    })

    it('should return null when currentRelationshipId is missing', () => {
      const auth = {
        artifacts: {
          decoded: {
            relationships: ['rel-id:org-123'],
            enrolmentCount: 1,
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBeNull()
    })

    it('should return organisation ID even when enrolmentCount is missing', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id:org-123'],
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBe('org-123')
    })

    it('should return null when relationships is not an array', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 1,
            relationships: 'not-an-array',
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBeNull()
    })

    it('should return organisation ID even when roles is not an array', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 1,
            relationships: ['rel-id:org-123'],
            roles: 'not-an-array'
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBe('org-123')
    })

    it('should return null when relationships is empty array', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 1,
            relationships: [],
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBeNull()
    })

    it('should return null when currentRelationshipId is empty string', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: '',
            enrolmentCount: 1,
            relationships: ['rel-id:org-123'],
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBeNull()
    })

    it('should return organisation ID even when enrolmentCount is 0', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 0,
            relationships: ['rel-id:org-123'],
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBe('org-123')
    })

    it('should return null when no matching relationship found', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'different-rel-id',
            enrolmentCount: 1,
            relationships: ['rel-id:org-123', 'other-rel:org-456'],
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBeNull()
    })

    it('should return null when relationship does not contain organisation ID', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 1,
            relationships: ['rel-id:'],
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBeNull()
    })
  })

  describe('Valid cases', () => {
    it('should return organisation ID from valid relationship', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 1,
            relationships: [
              'rel-id:27d48d6c-6e94-f011-b4cc-000d3ac28f39:CDP Child Org 1:0:Employee:0'
            ],
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBe('27d48d6c-6e94-f011-b4cc-000d3ac28f39')
    })

    it('should extract organisation ID from complex relationship string', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: '81d48d6c-6e94-f011-b4cc-000d3ac28f39',
            enrolmentCount: 2,
            relationships: [
              '81d48d6c-6e94-f011-b4cc-000d3ac28f39:27d48d6c-6e94-f011-b4cc-000d3ac28f39:CDP Child Org 1:0:Employee:0',
              'other-rel:other-org:Org 2:0:Admin:0'
            ],
            roles: ['Employee', 'Admin']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBe('27d48d6c-6e94-f011-b4cc-000d3ac28f39')
    })

    it('should return first matching relationship organisation ID', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 1,
            relationships: [
              'rel-id:org-123:Org Name:0:Employee:0',
              'rel-id:org-456:Another Org:0:Admin:0'
            ],
            roles: ['Employee', 'Admin']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBe('org-123')
    })

    it('should work with single role', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 1,
            relationships: ['rel-id:org-123'],
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBe('org-123')
    })

    it('should work with multiple roles', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 3,
            relationships: ['rel-id:org-123:Org:0:Employee:0'],
            roles: ['Employee', 'Admin', 'Approver']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBe('org-123')
    })

    it('should work with high enrolment count', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            enrolmentCount: 100,
            relationships: ['rel-id:org-123:Org:0:Employee:0'],
            roles: ['Employee']
          }
        }
      }
      const result = getOrganisationIdFromAuthToken(auth)
      expect(result).toBe('org-123')
    })
  })
})

describe('getOrganisationDetailsFromAuthToken', () => {
  describe('Error handling - returns default Citizen response', () => {
    it('should return default values when auth is null', () => {
      const result = getOrganisationDetailsFromAuthToken(null)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })

    it('should return default values when auth is undefined', () => {
      const result = getOrganisationDetailsFromAuthToken(undefined)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })

    it('should return default values when artifacts is undefined', () => {
      const auth = {}
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })

    it('should return default values when decoded is undefined', () => {
      const auth = { artifacts: {} }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })

    it('should return default values when currentRelationshipId is missing', () => {
      const auth = {
        artifacts: {
          decoded: {
            relationships: ['rel-id:org-123:Org Name:0:Employee:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })

    it('should return default values when currentRelationshipId is empty string', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: '',
            relationships: ['rel-id:org-123:Org Name:0:Employee:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })

    it('should return default values when relationships is not an array', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: 'not-an-array'
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })

    it('should return default values when relationships is empty array', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: []
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })

    it('should return default values when no matching relationship found', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'different-rel-id',
            relationships: ['rel-id:org-123:Org Name:0:Employee:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })

    it('should return default values when relationship has fewer than 5 parts', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id:org-123:Org Name:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: null,
        organisationName: null,
        userRelationshipType: 'Citizen'
      })
    })
  })

  describe('Valid cases - Employee', () => {
    it('should return organisation details for Employee relationship', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: '81d48d6c-6e94-f011-b4cc-000d3ac28f39',
            relationships: [
              '81d48d6c-6e94-f011-b4cc-000d3ac28f39:27d48d6c-6e94-f011-b4cc-000d3ac28f39:Child Org 1:0:Employee:0'
            ]
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: '27d48d6c-6e94-f011-b4cc-000d3ac28f39',
        organisationName: 'Child Org 1',
        userRelationshipType: 'Employee'
      })
    })

    it('should return first matching relationship when multiple exist', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: [
              'rel-id:org-123:First Org:0:Employee:0',
              'rel-id:org-456:Second Org:0:Admin:0'
            ]
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: 'org-123',
        organisationName: 'First Org',
        userRelationshipType: 'Employee'
      })
    })
  })

  describe('Valid cases - Agent', () => {
    it('should return organisation details for Agent relationship', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id:org-123:Agency Ltd:0:Agent:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: 'org-123',
        organisationName: 'Agency Ltd',
        userRelationshipType: 'Agent'
      })
    })
  })

  describe('Valid cases - Citizen', () => {
    it('should return organisation details for Citizen relationship', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id:org-123:Personal:0:Citizen:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: 'org-123',
        organisationName: 'Personal',
        userRelationshipType: 'Citizen'
      })
    })
  })

  describe('Invalid relationship type - defaults to Citizen', () => {
    it('should default to Citizen when relationship type is unknown', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id:org-123:Org Name:0:UnknownType:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: 'org-123',
        organisationName: 'Org Name',
        userRelationshipType: 'Citizen'
      })
    })

    it('should default to Citizen when relationship type is Admin', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id:org-123:Org Name:0:Admin:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: 'org-123',
        organisationName: 'Org Name',
        userRelationshipType: 'Citizen'
      })
    })

    it('should default to Citizen when relationship type is empty', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id:org-123:Org Name:0::0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: 'org-123',
        organisationName: 'Org Name',
        userRelationshipType: 'Citizen'
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle empty organisationId in relationship', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id::Org Name:0:Employee:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: null,
        organisationName: 'Org Name',
        userRelationshipType: 'Employee'
      })
    })

    it('should handle empty organisationName in relationship', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id:org-123::0:Employee:0']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: 'org-123',
        organisationName: null,
        userRelationshipType: 'Employee'
      })
    })

    it('should handle relationship with extra colons in org name', () => {
      const auth = {
        artifacts: {
          decoded: {
            currentRelationshipId: 'rel-id',
            relationships: ['rel-id:org-123:Org:With:Colons:0:Employee:0:extra']
          }
        }
      }
      const result = getOrganisationDetailsFromAuthToken(auth)
      expect(result).toEqual({
        organisationId: 'org-123',
        organisationName: 'Org',
        userRelationshipType: 'Citizen'
      })
    })
  })
})
