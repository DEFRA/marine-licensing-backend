import Wreck from '@hapi/wreck'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'

import {
  setupAuthStrategy,
  fetchOidcConfig,
  setupDefraIdAuth,
  defraId,
  logRequestError,
  safeLog,
  debugHttpClients
} from './defra-id.js'

jest.mock('@hapi/bell')
jest.mock('@hapi/wreck')
jest.mock('@hapi/jwt')
jest.mock('../../../config.js')
jest.mock('../logging/logger.js')
jest.mock('node:https')

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

    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: Buffer.from(JSON.stringify(mockOidcConfig))
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

  describe('safeLog', () => {
    test('should handle missing logger gracefully', () => {
      const originalCreateLogger = require('../logging/logger.js').createLogger
      require('../logging/logger.js').createLogger = jest.fn(() => ({}))

      safeLog.info('test message')
      safeLog.error('test error')

      require('../logging/logger.js').createLogger = originalCreateLogger
    })
  })

  describe('fetchOidcConfig', () => {
    test('should fetch OIDC configuration successfully', async () => {
      const result = await fetchOidcConfig('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalledWith(
        'https://test-oidc-url',
        expect.any(Object)
      )
      expect(result).toEqual(mockOidcConfig)
    })

    test('should use proxy agent when available', async () => {
      await fetchOidcConfig('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalledWith(
        'https://test-oidc-url',
        expect.objectContaining({ agent: global.PROXY_AGENT })
      )
    })

    test('should handle missing proxy agent', async () => {
      delete global.PROXY_AGENT

      await fetchOidcConfig('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalledWith('https://test-oidc-url', {})
    })

    test('should throw error when response status is not ok', async () => {
      Wreck.get.mockResolvedValueOnce({
        res: { statusCode: 404, statusMessage: 'Not Found' },
        payload: Buffer.from('')
      })

      await expect(fetchOidcConfig('https://test-oidc-url')).rejects.toThrow(
        'Failed to fetch OIDC config: 404 Not Found'
      )
    })

    test('should throw error when Wreck request fails', async () => {
      const requestError = new Error('Network error')
      Wreck.get.mockRejectedValueOnce(requestError)

      await expect(fetchOidcConfig('https://test-oidc-url')).rejects.toThrow(
        'Network error'
      )
    })

    test('should handle Boom errors from Wreck', async () => {
      const boomError = new Error('Boom error')
      boomError.isBoom = true
      Wreck.get.mockRejectedValueOnce(boomError)

      await expect(fetchOidcConfig('https://test-oidc-url')).rejects.toThrow(
        'Failed to fetch OIDC config: Boom error'
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

    test('should handle location function without referrer', () => {
      setupAuthStrategy(mockServer, mockOidcConfig, 'https://test-callback')

      const strategyConfig = mockServer.auth.strategy.mock.calls[0][2]
      const locationFn = strategyConfig.location

      const mockRequest = {
        info: {},
        yar: { flash: jest.fn() }
      }

      const result = locationFn(mockRequest)

      expect(mockRequest.yar.flash).not.toHaveBeenCalled()
      expect(result).toBe('https://test-callback')
    })
  })

  describe('logRequestError', () => {
    test('should handle TLS-related errors', () => {
      const tlsError = new Error('TLS handshake failed')
      tlsError.name = 'FetchError'
      tlsError.type = 'system'
      tlsError.errno = 'ECONNRESET'

      logRequestError(tlsError)

      expect(tlsError.message).toContain('TLS')
    })

    test('should handle errors with cause property', () => {
      const causeError = new Error('Root cause error')
      causeError.code = 'ECAUSE'
      causeError.name = 'CauseError'
      causeError.stack = 'Cause stack trace'

      const mainError = new Error('Main error')
      mainError.cause = causeError

      logRequestError(mainError)

      expect(mainError.cause).toBe(causeError)
    })

    test('should handle errors with cause that has stack', () => {
      const causeError = new Error('Root cause with stack')
      causeError.stack = 'Detailed stack trace'

      const mainError = new Error('Main error')
      mainError.cause = causeError

      logRequestError(mainError)

      expect(mainError.cause.stack).toBe('Detailed stack trace')
    })

    test('should handle Boom errors and log details', () => {
      const boomError = new Error('Boom error message')
      boomError.isBoom = true
      boomError.output = {
        statusCode: 500,
        payload: { error: 'Internal Server Error' }
      }
      boomError.data = { custom: 'data' }

      logRequestError(boomError)

      expect(boomError.isBoom).toBe(true)
    })

    test('should handle RequestError type and log details', () => {
      const requestError = new Error('Request failed')
      requestError.name = 'RequestError'
      requestError.code = 'ECONNRESET'

      logRequestError(requestError)

      expect(requestError.name).toBe('RequestError')
    })

    test('should handle TLS errors and call logTlsRecommendations', () => {
      const tlsError = new Error('TLS connection failed')
      tlsError.name = 'RequestError'
      tlsError.message = 'TLS handshake error'

      logRequestError(tlsError)

      expect(tlsError.message).toContain('TLS')
    })

    test('should handle errors without cause', () => {
      const simpleError = new Error('Simple error')
      simpleError.name = 'SimpleError'
      simpleError.code = 'SIMPLE'

      logRequestError(simpleError)

      expect(simpleError.cause).toBeUndefined()
    })

    test('should handle errors without stack trace', () => {
      const errorWithoutStack = new Error('Error without stack')
      delete errorWithoutStack.stack

      logRequestError(errorWithoutStack)

      expect(errorWithoutStack.stack).toBeUndefined()
    })
  })

  describe('setupDefraIdAuth', () => {
    test('should fetch OIDC config and setup auth strategy', async () => {
      await setupDefraIdAuth(
        mockServer,
        'https://test-oidc-url',
        'https://test-callback'
      )

      expect(Wreck.get).toHaveBeenCalledWith(
        'https://test-oidc-url',
        expect.any(Object)
      )
      expect(mockServer.auth.strategy).toHaveBeenCalled()
      expect(mockServer.auth.default).toHaveBeenCalledWith('defra-id')
    })

    test('should throw errors from fetch operations', async () => {
      const fetchError = new Error('Fetch failed')
      Wreck.get.mockRejectedValueOnce(fetchError)

      await expect(
        setupDefraIdAuth(
          mockServer,
          'https://test-oidc-url',
          'https://test-callback'
        )
      ).rejects.toThrow('Fetch failed')
    })
  })

  describe('debugHttpClients', () => {
    test('should handle Wreck success and log appropriately', async () => {
      Wreck.get.mockResolvedValueOnce({
        res: { statusCode: 200 },
        payload: Buffer.from(JSON.stringify({ issuer: 'test-issuer' }))
      })

      await debugHttpClients('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalledWith('https://test-oidc-url', {
        timeout: 5000
      })
    })

    test('should handle Wreck failure gracefully', async () => {
      const wreckError = new Error('Wreck failed')
      wreckError.name = 'WreckError'
      wreckError.code = 'ECONNRESET'
      Wreck.get.mockRejectedValueOnce(wreckError)

      await debugHttpClients('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalled()
    })

    test('should handle Wreck Boom error gracefully', async () => {
      const boomError = new Error('Boom error')
      boomError.isBoom = true
      boomError.output = { statusCode: 500 }
      Wreck.get.mockRejectedValueOnce(boomError)

      await debugHttpClients('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalled()
    })
  })

  describe('defraId plugin', () => {
    test('should register the plugin successfully', async () => {
      delete process.env.NODE_ENV

      await defraId.plugin.register(mockServer)

      expect(config.get).toHaveBeenCalledWith('defraIdOidcConfigurationUrl')

      expect(mockServer.register).toHaveBeenCalled()

      expect(Wreck.get).toHaveBeenCalled()
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

      expect(Wreck.get).not.toHaveBeenCalled()

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
      expect(Wreck.get).not.toHaveBeenCalled()

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
      Wreck.get.mockRejectedValueOnce(oidcError)

      await expect(defraId.plugin.register(mockServer)).rejects.toThrow(
        'OIDC configuration failed'
      )
    })

    test('should log TLS environment variables when present', async () => {
      process.env.TRUSTSTORE_1 = 'cert1'
      process.env.TRUSTSTORE_2 = 'cert2'
      process.env.ENABLE_SECURE_CONTEXT = 'true'
      process.env.NODE_ENV = 'test'

      await defraId.plugin.register(mockServer)

      delete process.env.TRUSTSTORE_1
      delete process.env.TRUSTSTORE_2
      delete process.env.ENABLE_SECURE_CONTEXT
      delete process.env.NODE_ENV
    })

    test('should handle proxy agent with unknown proxy type', async () => {
      global.PROXY_AGENT = {
        proxy: null
      }

      await fetchOidcConfig('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalledWith(
        'https://test-oidc-url',
        expect.objectContaining({ agent: global.PROXY_AGENT })
      )
    })

    test('should run debug HTTP clients when DEBUG_HTTP_CLIENTS is enabled', async () => {
      process.env.DEBUG_HTTP_CLIENTS = 'true'
      delete process.env.NODE_ENV

      Wreck.get
        .mockResolvedValueOnce({
          res: { statusCode: 200 },
          payload: Buffer.from(JSON.stringify({ issuer: 'debug-issuer' }))
        })
        .mockResolvedValueOnce({
          res: { statusCode: 200 },
          payload: Buffer.from(JSON.stringify(mockOidcConfig))
        })

      await defraId.plugin.register(mockServer)

      expect(Wreck.get).toHaveBeenCalledWith(
        mockConfig.defraIdOidcConfigurationUrl,
        { timeout: 5000 }
      )

      delete process.env.DEBUG_HTTP_CLIENTS
    })

    test('should continue on error when DEBUG_CONTINUE_ON_ERROR is enabled', async () => {
      process.env.DEBUG_CONTINUE_ON_ERROR = 'true'
      delete process.env.NODE_ENV

      const oidcError = new Error('OIDC configuration failed')
      Wreck.get.mockRejectedValueOnce(oidcError)

      await defraId.plugin.register(mockServer)

      expect(mockServer.auth.default).toHaveBeenCalledWith('dummy')
      expect(mockServer.register).toHaveBeenCalled()

      delete process.env.DEBUG_CONTINUE_ON_ERROR
    })

    test('should throw error normally when DEBUG_CONTINUE_ON_ERROR is not enabled', async () => {
      delete process.env.DEBUG_CONTINUE_ON_ERROR
      delete process.env.NODE_ENV

      const oidcError = new Error('OIDC configuration failed')
      Wreck.get.mockRejectedValueOnce(oidcError)

      await expect(defraId.plugin.register(mockServer)).rejects.toThrow(
        'OIDC configuration failed'
      )
    })

    test('should log success message when OIDC setup completes', async () => {
      delete process.env.NODE_ENV

      await defraId.plugin.register(mockServer)

      expect(Wreck.get).toHaveBeenCalled()
      expect(mockServer.auth.strategy).toHaveBeenCalled()
    })
  })
})
