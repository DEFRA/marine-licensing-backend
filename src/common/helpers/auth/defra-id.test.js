import Wreck from '@hapi/wreck'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'

import {
  setupAuthStrategy,
  fetchOidcConfig,
  setupDefraIdAuth,
  defraId,
  safeLog,
  debugHttpClients
} from './defra-id.js'

jest.mock('@hapi/bell')
jest.mock('@hapi/wreck')
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

      expect(Wreck.get).toHaveBeenCalledWith('https://test-oidc-url')
      expect(result).toEqual(mockOidcConfig)
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

  describe('setupDefraIdAuth', () => {
    test('should fetch OIDC config and setup auth strategy', async () => {
      await setupDefraIdAuth(
        mockServer,
        'https://test-oidc-url',
        'https://test-callback'
      )

      expect(Wreck.get).toHaveBeenCalledWith('https://test-oidc-url')
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
    test('should test Wreck HTTP client successfully', async () => {
      await debugHttpClients('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalledWith('https://test-oidc-url', {
        timeout: 5000
      })
    })

    test('should handle Wreck errors gracefully', async () => {
      const wreckError = new Error('Network error')
      wreckError.code = 'ECONNREFUSED'
      Wreck.get.mockRejectedValueOnce(wreckError)

      await debugHttpClients('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalledWith('https://test-oidc-url', {
        timeout: 5000
      })
    })

    test('should handle Boom errors from Wreck', async () => {
      const boomError = new Error('Boom error')
      boomError.isBoom = true
      boomError.output = {
        statusCode: 500,
        payload: { message: 'Server error' }
      }
      Wreck.get.mockRejectedValueOnce(boomError)

      await debugHttpClients('https://test-oidc-url')

      expect(Wreck.get).toHaveBeenCalledWith('https://test-oidc-url', {
        timeout: 5000
      })
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

      await defraId.plugin.register(mockServer)

      expect(mockServer.auth.default).toHaveBeenCalledWith('dummy')
      expect(mockServer.register).not.toHaveBeenCalled()
      expect(Wreck.get).not.toHaveBeenCalled()

      delete process.env.NODE_ENV
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

    test('should run debug HTTP clients when DEBUG_HTTP_CLIENTS=true', async () => {
      process.env.DEBUG_HTTP_CLIENTS = 'true'
      delete process.env.NODE_ENV

      await defraId.plugin.register(mockServer)

      // Should call Wreck.get twice: once for debug, once for actual setup
      expect(Wreck.get).toHaveBeenCalledTimes(2)
      expect(Wreck.get).toHaveBeenCalledWith(
        mockConfig.defraIdOidcConfigurationUrl,
        {
          timeout: 5000
        }
      )

      delete process.env.DEBUG_HTTP_CLIENTS
    })

    test('should handle debug HTTP client errors gracefully', async () => {
      process.env.DEBUG_HTTP_CLIENTS = 'true'
      delete process.env.NODE_ENV

      // Make debug call fail but main call succeed
      Wreck.get
        .mockRejectedValueOnce(new Error('Debug failed'))
        .mockResolvedValueOnce({
          res: { statusCode: 200 },
          payload: Buffer.from(JSON.stringify(mockOidcConfig))
        })

      await defraId.plugin.register(mockServer)

      expect(Wreck.get).toHaveBeenCalledTimes(2)
      expect(mockServer.auth.strategy).toHaveBeenCalled()

      delete process.env.DEBUG_HTTP_CLIENTS
    })

    test('should continue with dummy auth when DEBUG_CONTINUE_ON_ERROR=true', async () => {
      process.env.DEBUG_CONTINUE_ON_ERROR = 'true'
      delete process.env.NODE_ENV

      const oidcError = new Error('OIDC configuration failed')
      Wreck.get.mockRejectedValueOnce(oidcError)

      await defraId.plugin.register(mockServer)

      expect(mockServer.auth.default).toHaveBeenCalledWith('dummy')

      delete process.env.DEBUG_CONTINUE_ON_ERROR
    })
  })
})
