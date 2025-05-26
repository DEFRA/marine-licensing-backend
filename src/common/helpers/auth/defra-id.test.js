import fetch from 'node-fetch'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'

import {
  setupAuthStrategy,
  fetchOidcConfig,
  setupDefraIdAuth,
  defraId,
  logFetchError
} from './defra-id.js'

jest.mock('@hapi/bell')
jest.mock('node-fetch')
jest.mock('@hapi/jwt')
jest.mock('../../../config.js')
jest.mock('../logging/logger.js')

describe('defra-id.js', () => {
  const mockServer = {
    auth: {
      strategy: jest.fn(),
      default: jest.fn()
    },
    register: jest.fn().mockResolvedValue()
  }

  const mockConfig = {
    defraIdClientId: 'test-client-id',
    defraIdClientSecret: 'test-client-secret',
    defraIdCookiePassword: 'test-cookie-password',
    defraIdServiceId: 'test-service-id',
    defraIdOidcConfigurationUrl: 'https://test-oidc-config-url',
    cdpEnvironment: 'test',
    isSecureContextEnabled: true,
    httpProxy: 'http://test-proxy:8080',
    redirectUri: 'https://test-callback-url'
  }

  const mockOidcConfig = {
    authorization_endpoint: 'https://test-auth-endpoint',
    token_endpoint: 'https://test-token-endpoint',
    end_session_endpoint: 'https://test-logout-endpoint'
  }

  beforeEach(() => {
    jest.clearAllMocks()

    config.get.mockImplementation((key) => mockConfig[key])

    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockOidcConfig)
    })

    Jwt.token.decode.mockReturnValue({
      decoded: {
        payload: {
          sub: 'test-subject',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          roles: ['user'],
          relationships: []
        }
      }
    })

    global.PROXY_AGENT = {
      proxy: {
        toString: () => 'http://test-proxy:8080'
      }
    }
  })

  afterEach(() => {
    delete global.PROXY_AGENT
  })

  describe('fetchOidcConfig', () => {
    test('should fetch OIDC configuration successfully', async () => {
      const result = await fetchOidcConfig('https://test-oidc-url')

      expect(fetch).toHaveBeenCalledWith(
        'https://test-oidc-url',
        expect.any(Object)
      )
      expect(result).toEqual(mockOidcConfig)
    })

    test('should use proxy agent when available', async () => {
      await fetchOidcConfig('https://test-oidc-url')

      expect(fetch).toHaveBeenCalledWith(
        'https://test-oidc-url',
        expect.objectContaining({ agent: global.PROXY_AGENT })
      )
    })

    test('should handle missing proxy agent', async () => {
      delete global.PROXY_AGENT

      await fetchOidcConfig('https://test-oidc-url')

      expect(fetch).toHaveBeenCalledWith('https://test-oidc-url', {})
    })

    test('should throw error when fetch response is not ok', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      await expect(fetchOidcConfig('https://test-oidc-url')).rejects.toThrow(
        'Failed to fetch OIDC config: 404 Not Found'
      )
    })

    test('should throw error when fetch fails', async () => {
      const fetchError = new Error('Network error')
      fetch.mockRejectedValueOnce(fetchError)

      await expect(fetchOidcConfig('https://test-oidc-url')).rejects.toThrow(
        'Network error'
      )
    })
  })

  describe('setupAuthStrategy', () => {
    test('should configure the auth strategy correctly', () => {
      setupAuthStrategy(mockServer, mockOidcConfig, 'https://test-callback')

      expect(mockServer.auth.strategy).toHaveBeenCalledWith(
        'defra-id',
        'bell',
        expect.objectContaining({
          clientId: mockConfig.defraIdClientId,
          clientSecret: mockConfig.defraIdClientSecret,
          password: mockConfig.defraIdCookiePassword,
          cookie: 'bell-defra-id',
          isSecure: false,
          providerParams: {
            serviceId: mockConfig.defraIdServiceId
          }
        })
      )

      expect(mockServer.auth.default).toHaveBeenCalledWith('defra-id')
    })

    test('should configure provider endpoints correctly', () => {
      setupAuthStrategy(mockServer, mockOidcConfig, 'https://test-callback')

      const strategyConfig = mockServer.auth.strategy.mock.calls[0][2]

      expect(strategyConfig.provider.auth).toBe(
        mockOidcConfig.authorization_endpoint
      )
      expect(strategyConfig.provider.token).toBe(mockOidcConfig.token_endpoint)
      expect(strategyConfig.provider.scope).toEqual([
        'openid',
        'offline_access'
      ])
    })

    test('should process JWT token and set profile correctly', () => {
      setupAuthStrategy(mockServer, mockOidcConfig, 'https://test-callback')

      const strategyConfig = mockServer.auth.strategy.mock.calls[0][2]
      const profileFn = strategyConfig.provider.profile

      const credentials = { token: 'test-token' }
      const params = { id_token: 'test-id-token' }

      profileFn(credentials, params)

      expect(Jwt.token.decode).toHaveBeenCalledWith('test-token')
      expect(credentials.profile).toEqual({
        id: 'test-subject',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        roles: ['user'],
        relationships: [],
        rawIdToken: 'test-id-token',
        logoutUrl: mockOidcConfig.end_session_endpoint
      })
    })

    test('should configure location function to capture referrer', () => {
      setupAuthStrategy(mockServer, mockOidcConfig, 'https://test-callback')

      const strategyConfig = mockServer.auth.strategy.mock.calls[0][2]
      const locationFn = strategyConfig.location

      const mockRequest = {
        info: { referrer: 'https://previous-page' },
        yar: { flash: jest.fn() }
      }

      const result = locationFn(mockRequest)

      expect(mockRequest.yar.flash).toHaveBeenCalledWith(
        'referrer',
        'https://previous-page'
      )
      expect(result).toBe('https://test-callback')
    })
  })

  describe('logFetchError', () => {
    test('should handle TLS-related errors', () => {
      const tlsError = new Error('TLS handshake failed')
      tlsError.name = 'FetchError'
      tlsError.type = 'system'
      tlsError.errno = 'ECONNRESET'

      logFetchError(tlsError)

      expect(tlsError.message).toContain('TLS')
    })

    test('should handle errors with cause property', () => {
      const causeError = new Error('Root cause error')
      causeError.code = 'ECAUSE'
      causeError.name = 'CauseError'
      causeError.stack = 'Cause stack trace'

      const mainError = new Error('Main error')
      mainError.cause = causeError

      logFetchError(mainError)

      expect(mainError.cause).toBe(causeError)
    })

    test('should handle errors with cause that has stack', () => {
      const causeError = new Error('Root cause with stack')
      causeError.stack = 'Detailed stack trace'

      const mainError = new Error('Main error')
      mainError.cause = causeError

      logFetchError(mainError)

      expect(mainError.cause.stack).toBe('Detailed stack trace')
    })
  })

  describe('setupDefraIdAuth', () => {
    test('should fetch OIDC config and setup auth strategy', async () => {
      await setupDefraIdAuth(
        mockServer,
        'https://test-oidc-url',
        'https://test-callback'
      )

      expect(fetch).toHaveBeenCalledWith(
        'https://test-oidc-url',
        expect.any(Object)
      )
      expect(mockServer.auth.strategy).toHaveBeenCalled()
      expect(mockServer.auth.default).toHaveBeenCalledWith('defra-id')
    })

    test('should throw errors from fetch operations', async () => {
      const fetchError = new Error('Fetch failed')
      fetch.mockRejectedValueOnce(fetchError)

      await expect(
        setupDefraIdAuth(
          mockServer,
          'https://test-oidc-url',
          'https://test-callback'
        )
      ).rejects.toThrow('Fetch failed')
    })
  })

  describe('defraId plugin', () => {
    test('should register the plugin successfully', async () => {
      delete process.env.NODE_ENV

      await defraId.plugin.register(mockServer)

      expect(config.get).toHaveBeenCalledWith('defraIdOidcConfigurationUrl')

      expect(mockServer.register).toHaveBeenCalled()

      expect(fetch).toHaveBeenCalled()
    })

    test('should use dummy auth for test environment', async () => {
      process.env.NODE_ENV = 'test'

      const originalGet = config.get
      config.get = jest.fn((key) => {
        if (key === 'redirectUri') {
          throw new Error('redirectUri should not be accessed')
        }
        return mockConfig[key]
      })

      await defraId.plugin.register(mockServer)

      expect(mockServer.auth.default).toHaveBeenCalledWith('dummy')
      expect(mockServer.register).not.toHaveBeenCalled()

      expect(fetch).not.toHaveBeenCalled()

      delete process.env.NODE_ENV
      config.get = originalGet
    })

    test('should use dummy auth with null OIDC URL to cover early return', async () => {
      jest.clearAllMocks()

      const originalGet = config.get
      config.get = jest.fn((key) => {
        if (key === 'defraIdOidcConfigurationUrl') {
          return null
        }
        if (key === 'redirectUri') {
          throw new Error('redirectUri should not be accessed')
        }
        return mockConfig[key]
      })

      delete process.env.NODE_ENV

      await defraId.plugin.register(mockServer)

      expect(mockServer.auth.default).toHaveBeenCalledWith('dummy')

      expect(mockServer.register).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()

      config.get = originalGet
    })

    test('should use dummy auth when OIDC URL is not configured', async () => {
      config.get.mockImplementation((key) =>
        key === 'defraIdOidcConfigurationUrl' ? undefined : mockConfig[key]
      )

      await defraId.plugin.register(mockServer)

      expect(mockServer.auth.default).toHaveBeenCalledWith('dummy')
      expect(mockServer.register).not.toHaveBeenCalled()
    })

    test('should throw errors from OIDC configuration', async () => {
      const oidcError = new Error('OIDC configuration failed')
      fetch.mockRejectedValueOnce(oidcError)

      await expect(defraId.plugin.register(mockServer)).rejects.toThrow(
        'OIDC configuration failed'
      )
    })
  })
})
