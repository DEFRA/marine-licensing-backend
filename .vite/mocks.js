import { vi } from 'vitest'

const createMockRequest = (overrides = {}) => ({
  db: globalThis.mockMongo,
  logger: {
    info: vi.fn(),
    error: vi.fn()
  },
  ...overrides
})

export const requestFromInternalUser = (overrides = {}) => ({
  ...createMockRequest(overrides),
  auth: { artifacts: { decoded: { tid: 'abc' } } }
})

export const requestFromApplicantUser = (overrides) => {
  const { userContactId, organisationId, ...rest } = overrides || {}
  const relationships = organisationId
    ? [`rel-id:${organisationId}:Org Name:0:Employee:0`]
    : []
  return {
    ...createMockRequest(rest),
    auth: {
      credentials: { contactId: userContactId || '1' },
      artifacts: {
        decoded: {
          ...(organisationId && { currentRelationshipId: 'rel-id' }),
          relationships
        }
      }
    }
  }
}

export const requestFromPublicUser = (overrides) => createMockRequest(overrides)
