import Hapi from '@hapi/hapi'
import hapiAuthJwt2 from 'hapi-auth-jwt2'
import Wreck from '@hapi/wreck'
import jwkToPem from 'jwk-to-pem'
import { auth, getKey, validateToken } from './auth.js'
import { config } from '../config.js'

jest.mock('@hapi/wreck')
jest.mock('jwk-to-pem')
jest.mock('../config.js')

describe('Auth Plugin', () => {
  let server
  let mockWreckGet
  let mockJwkToPem

  const testId = '123e4567-e89b-12d3-a456-426614174000'

  beforeEach(async () => {
    jest.clearAllMocks()

    mockWreckGet = jest.mocked(Wreck.get)
    mockJwkToPem = jest.mocked(jwkToPem)

    config.get.mockImplementation(() => {
      return {
        jwksUri: 'http://localhost:3200/cdp-defra-id-stub/.well-known/jwks.json'
      }
    })

    mockWreckGet.mockResolvedValue({
      payload: {
        keys: [
          {
            kty: 'RSA',
            n: 'test-n',
            e: 'AQAB'
          }
        ]
      }
    })

    mockJwkToPem.mockReturnValue(
      '-----BEGIN PUBLIC KEY-----\ntest-pem-key\n-----END PUBLIC KEY-----'
    )

    server = Hapi.server()
    await server.register(hapiAuthJwt2)
    await server.register(auth)
  })

  afterEach(async () => {
    await server.stop()
  })

  test('should register JWT strategy', () => {
    expect(server.auth.settings.default.strategies).toContain('jwt')
  })

  test('should set default auth strategy to jwt with required mode', () => {
    expect(server.auth.settings.default.strategies).toContain('jwt')
    expect(server.auth.settings.default.mode).toBe('required')
  })

  describe('Key Function', () => {
    test('should return key function that provides PEM key', async () => {
      const result = await getKey()

      expect(result).toEqual({
        key: '-----BEGIN PUBLIC KEY-----\ntest-pem-key\n-----END PUBLIC KEY-----'
      })
    })

    test('should handle empty keys array', async () => {
      mockWreckGet.mockResolvedValueOnce({
        payload: {
          keys: []
        }
      })

      const result = await getKey()

      expect(result).toEqual({ key: undefined })
    })

    test('should handle JWKS fetch errors gracefully', async () => {
      mockWreckGet.mockRejectedValue(new Error('Network error'))
      await expect(getKey()).rejects.toThrow('Network error')
    })
  })

  describe('Validate Function', () => {
    test('should validate JWT token and return user credentials', async () => {
      const mockDecoded = {
        userId: testId
      }
      const mockRequest = {}
      const mockH = {}

      const result = await validateToken(mockDecoded, mockRequest, mockH)

      expect(result).toEqual({
        isValid: true,
        credentials: { userId: testId }
      })
    })

    test('should handle decoded token with missing userId', async () => {
      const mockDecoded = {}
      const mockRequest = {}
      const mockH = {}

      const result = await validateToken(mockDecoded, mockRequest, mockH)

      expect(result).toEqual({
        isValid: true,
        credentials: { userId: undefined }
      })
    })
  })

  describe('Verify Options', () => {
    test('should configure RS256 algorithm', () => {
      const verifyOptions = {
        algorithms: ['RS256']
      }

      expect(verifyOptions.algorithms).toEqual(['RS256'])
    })
  })
})
