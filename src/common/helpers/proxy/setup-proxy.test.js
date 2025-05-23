import { config } from '../../../config.js'
import { getGlobalDispatcher, ProxyAgent, setGlobalDispatcher } from 'undici'
import * as setupProxyModule from './setup-proxy.js'
import { bootstrap } from 'global-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'

const { setupProxy, isTlsError } = setupProxyModule

jest.mock('../../../config.js')
jest.mock('undici')
jest.mock('global-agent')
jest.mock('https-proxy-agent')

describe('setupProxy', () => {
  let mockLogger
  let originalNoProxy

  beforeEach(() => {
    originalNoProxy = process.env.NO_PROXY

    jest.clearAllMocks()

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    setupProxyModule.logger.info = mockLogger.info
    setupProxyModule.logger.error = mockLogger.error
    setupProxyModule.logger.warn = mockLogger.warn

    global.GLOBAL_AGENT = undefined
    global.PROXY_AGENT = undefined

    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return null
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    delete process.env.NO_PROXY
  })

  afterEach(() => {
    if (originalNoProxy !== undefined) {
      process.env.NO_PROXY = originalNoProxy
    } else {
      delete process.env.NO_PROXY
    }
  })

  test('Should not setup proxy if the environment variable is not set', () => {
    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return null
      return null
    })

    setupProxy()

    expect(global?.GLOBAL_AGENT?.HTTP_PROXY).toBeUndefined()
    expect(mockLogger.info).toHaveBeenCalledWith(
      'No HTTP_PROXY environment variable found, skipping proxy setup'
    )
  })

  test('Should setup proxy if the environment variable is set', () => {
    const mockProxyAgent = {}
    ProxyAgent.mockReturnValue(mockProxyAgent)
    getGlobalDispatcher.mockReturnValue(mockProxyAgent)
    bootstrap.mockImplementation(() => {
      global.GLOBAL_AGENT = {}
    })
    HttpsProxyAgent.mockReturnValue({})

    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return 'http://localhost:8080'
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxy()

    expect(setGlobalDispatcher).toHaveBeenCalled()
    expect(bootstrap).toHaveBeenCalled()

    expect(mockLogger.info).toHaveBeenCalled()
    expect(mockLogger.info.mock.calls.length).toBeGreaterThan(0)
  })

  test('Should setup HttpsProxyAgent with the provided proxy URL', () => {
    const mockProxyAgent = {}
    const mockHttpsProxyAgent = { proxy: 'mocked-agent' }

    ProxyAgent.mockReturnValue(mockProxyAgent)
    HttpsProxyAgent.mockReturnValue(mockHttpsProxyAgent)

    bootstrap.mockImplementation(() => {
      global.GLOBAL_AGENT = {}
    })

    const proxyUrl = 'http://proxy.example.com:8080'
    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return proxyUrl
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxy()

    expect(HttpsProxyAgent).toHaveBeenCalledWith(proxyUrl, {
      rejectUnauthorized: false
    })

    expect(global.PROXY_AGENT).toBe(mockHttpsProxyAgent)

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Setting up HttpsProxyAgent for node-fetch...'
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      'HttpsProxyAgent setup completed with custom TLS options'
    )
  })

  test('Should set global-agent with proper NO_PROXY from environment', () => {
    ProxyAgent.mockReturnValue({})
    HttpsProxyAgent.mockReturnValue({})

    const customNoProxy = 'internal.example.com,localhost'
    process.env.NO_PROXY = customNoProxy

    bootstrap.mockImplementation(() => {
      global.GLOBAL_AGENT = {}
    })

    const proxyUrl = 'http://proxy.example.com:8080'
    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return proxyUrl
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxy()

    expect(global.GLOBAL_AGENT.HTTP_PROXY).toBe(proxyUrl)
    expect(global.GLOBAL_AGENT.HTTPS_PROXY).toBe(proxyUrl)
    expect(global.GLOBAL_AGENT.NO_PROXY).toBe(customNoProxy)

    expect(mockLogger.info).toHaveBeenCalledWith('global-agent setup completed')
  })

  test('Should set global-agent with default NO_PROXY when not in environment', () => {
    ProxyAgent.mockReturnValue({})
    HttpsProxyAgent.mockReturnValue({})

    bootstrap.mockImplementation(() => {
      global.GLOBAL_AGENT = {}
    })

    delete process.env.NO_PROXY

    const proxyUrl = 'http://proxy.example.com:8080'
    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return proxyUrl
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxy()

    expect(global.GLOBAL_AGENT.HTTP_PROXY).toBe(proxyUrl)
    expect(global.GLOBAL_AGENT.HTTPS_PROXY).toBe(proxyUrl)
    expect(global.GLOBAL_AGENT.NO_PROXY).toBe('localhost,127.0.0.1')

    expect(mockLogger.info).toHaveBeenCalledWith('global-agent setup completed')
  })

  test('Should handle errors during proxy setup', () => {
    const mockError = new Error('Test error')
    mockError.code = 'TEST_ERROR_CODE'
    mockError.stack = 'Test error stack'

    setGlobalDispatcher.mockImplementation(() => {
      throw mockError
    })

    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return 'http://localhost:8080'
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxy()

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error setting up proxy: Test error'
    )
    expect(mockLogger.error).toHaveBeenCalledWith('Error name: Error')
    expect(mockLogger.error).toHaveBeenCalledWith('Error code: TEST_ERROR_CODE')
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error stack: Test error stack'
    )
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Continuing application startup despite proxy setup failure'
    )
  })

  test('Should handle errors during HttpsProxyAgent setup', () => {
    ProxyAgent.mockReturnValue({})
    bootstrap.mockImplementation(() => {
      global.GLOBAL_AGENT = {}
    })

    const httpsProxyError = new Error('HttpsProxyAgent error')
    httpsProxyError.code = 'HTTPS_PROXY_ERROR'
    httpsProxyError.stack = 'HttpsProxyAgent error stack'

    setGlobalDispatcher.mockImplementation(() => {})
    HttpsProxyAgent.mockImplementation(() => {
      throw httpsProxyError
    })

    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return 'http://localhost:8080'
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxy()

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error setting up proxy: HttpsProxyAgent error'
    )
    expect(mockLogger.error).toHaveBeenCalledWith('Error name: Error')
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error code: HTTPS_PROXY_ERROR'
    )
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error stack: HttpsProxyAgent error stack'
    )
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Continuing application startup despite proxy setup failure'
    )
    expect(global.PROXY_AGENT).toBeUndefined()
  })

  test('Should fallback to info logging when warn is not available', () => {
    const mockError = new Error('Test error')
    mockError.code = 'TEST_ERROR_CODE'
    mockError.stack = 'Test error stack'

    setGlobalDispatcher.mockImplementation(() => {
      throw mockError
    })

    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return 'http://localhost:8080'
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxyModule.logger.warn = undefined

    setupProxy()

    expect(mockLogger.info).toHaveBeenCalledWith(
      'WARN: Continuing application startup despite proxy setup failure'
    )
  })

  test('Should log TLS diagnostic information for specific error types', () => {
    const mockError = new Error('TLS handshake failed')
    mockError.code = 'ECONNRESET'
    mockError.stack = 'Test error stack'

    setGlobalDispatcher.mockImplementation(() => {
      throw mockError
    })

    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return 'http://localhost:8080'
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxy()

    expect(mockLogger.error).toHaveBeenCalledWith(
      'This appears to be a TLS/certificate validation issue.'
    )
    expect(mockLogger.error).toHaveBeenCalledWith('Please check:')
    expect(mockLogger.error).toHaveBeenCalledWith(
      '1. Your proxy configuration can access the target URL'
    )
    expect(mockLogger.error).toHaveBeenCalledWith(
      '2. Your certificates are in the correct PEM format'
    )
    expect(mockLogger.error).toHaveBeenCalledWith(
      '3. Your ENABLE_SECURE_CONTEXT setting is correct'
    )
  })

  test('Should handle different environment configurations', () => {
    // This is a simplified test that just verifies the function runs without errors
    // under different environment configurations

    // Test with production environment
    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return 'http://proxy.example.com:8080'
      if (key === 'cdpEnvironment') return 'production'
      if (key === 'isSecureContextEnabled') return true
      return null
    })

    ProxyAgent.mockReturnValue({})
    HttpsProxyAgent.mockReturnValue({})
    bootstrap.mockImplementation(() => {
      global.GLOBAL_AGENT = {}
    })

    // Should not throw
    expect(() => setupProxy()).not.toThrow()

    // Test with test environment and secure context disabled
    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return 'http://proxy.example.com:8080'
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    // Should not throw
    expect(() => setupProxy()).not.toThrow()
  })

  test('Should log warning when no TLS environment variables are found', () => {
    ProxyAgent.mockReturnValue({})
    HttpsProxyAgent.mockReturnValue({})
    bootstrap.mockImplementation(() => {
      global.GLOBAL_AGENT = {}
    })

    // Clear any TLS environment variables that might be set
    const originalEnv = { ...process.env }
    Object.keys(process.env)
      .filter(
        (key) =>
          key.startsWith('TRUSTSTORE_') ||
          key.startsWith('NODE_TLS_') ||
          key === 'ENABLE_SECURE_CONTEXT'
      )
      .forEach((key) => {
        delete process.env[key]
      })

    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return 'http://proxy.example.com:8080'
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxy()

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'No TLS environment variables found, which may cause certificate validation issues'
    )

    // Restore the original environment
    process.env = originalEnv
  })

  test('Should log TLS environment variables when found', () => {
    ProxyAgent.mockReturnValue({})
    HttpsProxyAgent.mockReturnValue({})
    bootstrap.mockImplementation(() => {
      global.GLOBAL_AGENT = {}
    })

    // Set some TLS environment variables
    const originalEnv = { ...process.env }
    process.env.TRUSTSTORE_1 = 'mock-cert'
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    config.get.mockImplementation((key) => {
      if (key === 'httpProxy') return 'http://proxy.example.com:8080'
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'isSecureContextEnabled') return false
      return null
    })

    setupProxy()

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringMatching(
        /TLS environment variables found: .*TRUSTSTORE_1.*NODE_TLS_REJECT_UNAUTHORIZED.*/
      )
    )

    // Restore the original environment
    process.env = originalEnv
  })
})

describe('isTlsError', () => {
  test('Should identify TLS errors by error code', () => {
    const error = new Error('Connection reset')
    error.code = 'ECONNRESET'

    expect(isTlsError(error)).toBe(true)
  })

  test('Should identify TLS errors by message content', () => {
    const error = new Error('Failed to establish TLS connection')
    expect(isTlsError(error)).toBe(true)

    const certificateError = new Error('Invalid certificate')
    expect(isTlsError(certificateError)).toBe(true)

    const sslError = new Error('SSL handshake failed')
    expect(isTlsError(sslError)).toBe(true)
  })

  test('Should return false for non-TLS errors', () => {
    const error = new Error('Generic error')
    error.code = 'GENERIC_ERROR'

    expect(isTlsError(error)).toBe(false)
  })

  test('Should handle null or undefined errors', () => {
    expect(isTlsError(null)).toBe(false)
    expect(isTlsError(undefined)).toBe(false)
  })
})
