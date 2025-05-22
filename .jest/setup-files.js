// Create a mock logger that can be accessed in tests
global.mockLogger = {
  info: jest.fn(),
  error: jest.fn()
}

// Mock the logger module to return our mock logger
jest.mock('../src/common/helpers/logging/logger.js', () => ({
  createLogger: jest.fn(() => global.mockLogger)
}))

// Mock out node-fetch so Jest never tries to parse its ESM sources
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      authorization_endpoint: 'https://auth/',
      token_endpoint: 'https://token/',
      end_session_endpoint: 'https://logout/'
    })
  })
}))

// node-fetch depends on fetch-blob, which is also ESM-only
jest.mock('fetch-blob', () => ({
  __esModule: true,
  default: class {}
}))

// Mock @hapi/jwt so we don't need to transpile it either
jest.mock('@hapi/jwt', () => {
  const mockJwt = {
    __esModule: true,
    default: {
      token: {
        decode: jest.fn().mockReturnValue({
          decoded: {
            payload: {
              sub: 'mock-user',
              firstName: 'Mock',
              lastName: 'User',
              email: 'mock@example.com',
              roles: ['role1', 'role2'],
              relationships: ['org1']
            }
          }
        })
      }
    }
  }

  // For destructured imports
  mockJwt.token = mockJwt.default.token

  return mockJwt
})
