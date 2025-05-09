// Mock out node-fetch so Jest never tries to parse its ESM sources
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
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

// Mock @hapi/jwt so we don’t need to transpile it either
jest.mock('@hapi/jwt', () => ({
  __esModule: true,
  token: {
    decode: () => ({ decoded: { payload: {} } })
  }
}))
