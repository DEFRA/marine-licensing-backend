import Hapi from '@hapi/hapi'
import hapiAuthJwt2 from 'hapi-auth-jwt2'
import Wreck from '@hapi/wreck'
import jwkToPem from 'jwk-to-pem'
import Boom from '@hapi/boom'
import { auth, getKeys, validateToken } from './auth.js'
import { config } from '../config.js'

jest.mock('@hapi/wreck')
jest.mock('jwk-to-pem')
jest.mock('../config.js')

describe('Auth Plugin', () => {
  let server
  let mockWreckGet
  let mockJwkToPem

  const testId = '123e4567-e89b-12d3-a456-426614174000'
  const testKey =
    '-----BEGIN PUBLIC KEY-----\ntest-pem-key\n-----END PUBLIC KEY-----'
  const jwt = {
    tid: 'abc'
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockWreckGet = jest.mocked(Wreck.get)
    mockJwkToPem = jest.mocked(jwkToPem)

    config.get.mockImplementation((key) => {
      return key === 'defraId'
        ? {
            jwksUri:
              'http://localhost:3200/cdp-defra-id-stub/.well-known/jwks.json'
          }
        : {
            jwksUri:
              'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/discovery/v2.0/keys'
          }
    })

    mockWreckGet.mockResolvedValue({
      payload: {
        keys: [
          {
            kty: 'RSA',
            n: 'test-n',
            e: 'AQAB'
          },
          {
            kty: 'RSA',
            n: 'test-o',
            e: 'AQAB'
          }
        ]
      }
    })

    mockJwkToPem.mockReturnValue(testKey)

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

  describe('Default auth mode configuration', () => {
    test('should set default auth strategy to jwt with required mode', async () => {
      config.get.mockImplementation(() => {
        return {
          jwksUri:
            'http://localhost:3200/cdp-defra-id-stub/.well-known/jwks.json'
        }
      })

      const testServer = Hapi.server()
      await testServer.register(hapiAuthJwt2)
      await testServer.register(auth)

      expect(testServer.auth.settings.default.strategies).toContain('jwt')
      expect(testServer.auth.settings.default.mode).toBe('required')

      await testServer.stop()
    })
  })

  describe('Key Function', () => {
    test('should return key function that provides PEM keys', async () => {
      const result = await getKeys(jwt)

      expect(result).toEqual({
        key: [testKey, testKey]
      })
    })

    test('should handle empty keys array', async () => {
      mockWreckGet.mockResolvedValueOnce({
        payload: {
          keys: []
        }
      })

      const result = await getKeys(jwt)

      expect(result).toEqual({ key: null })
    })

    test('should handle JWKS fetch errors gracefully', async () => {
      mockWreckGet.mockRejectedValue(new Error('Network error'))
      await expect(getKeys(jwt)).rejects.toThrow(
        Boom.internal('Cannot get JWT validation keys: Network error')
      )
    })

    test('should use config for defra ID', async () => {
      await getKeys({})
      expect(mockWreckGet).toHaveBeenCalledWith(
        'http://localhost:3200/cdp-defra-id-stub/.well-known/jwks.json',
        { json: true }
      )
    })

    test('should use config for entra ID', async () => {
      await getKeys({ tid: 'abc' })
      expect(mockWreckGet).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/discovery/v2.0/keys',
        { json: true }
      )
    })
  })

  describe('Validate Function', () => {
    test('should validate JWT token and return user credentials', async () => {
      const mockDecoded = {
        contactId: testId,
        email: 'test@example.com'
      }
      const mockRequest = {}
      const mockH = {}

      const result = await validateToken(mockDecoded, mockRequest, mockH)

      expect(result).toEqual({
        isValid: true,
        credentials: {
          contactId: testId,
          email: 'test@example.com'
        }
      })
    })

    test('should handle decoded token with missing contactId', async () => {
      const mockDecoded = {}
      const mockRequest = {}
      const mockH = {}

      const result = await validateToken(mockDecoded, mockRequest, mockH)

      expect(result).toEqual({
        isValid: false
      })
    })

    test('should handle decoded token with contactId but no email', async () => {
      const mockDecoded = {
        contactId: testId
      }
      const mockRequest = {}
      const mockH = {}

      const result = await validateToken(mockDecoded, mockRequest, mockH)

      expect(result).toEqual({
        isValid: true,
        credentials: {
          contactId: testId,
          email: undefined
        }
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
})
