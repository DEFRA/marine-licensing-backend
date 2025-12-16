const createMockRequest = (overrides = {}) => ({
  db: global.mockMongo,
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

export const requestFromApplicantUser = (overrides) => ({
  ...createMockRequest(overrides),
  auth: {
    credentials: { contactId: overrides.userContactId || '1' },
    artifacts: { decoded: {} }
  }
})

export const requestFromPublicUser = (overrides) => createMockRequest(overrides)
