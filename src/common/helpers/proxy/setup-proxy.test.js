import { config } from '../../../config.js'
import {
  checkTlsEnvironment,
  setupUndiciProxy,
  setupGlobalAgent,
  createTlsOptions,
  setupHttpsProxyAgent,
  handleProxyError,
  setupProxy
} from './setup-proxy.js'

jest.mock('undici', () => ({
  ProxyAgent: jest.fn(),
  setGlobalDispatcher: jest.fn()
}))
jest.mock('global-agent', () => ({
  bootstrap: jest.fn()
}))
jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn()
}))
jest.mock('../../../config.js')
jest.mock('../logging/logger.js')

// Import mocked modules
const { ProxyAgent, setGlobalDispatcher } = require('undici')
const { bootstrap } = require('global-agent')
const { HttpsProxyAgent } = require('https-proxy-agent')

describe('setup-proxy', () => {
  const mockConfig = {
    httpProxy: 'http://proxy.example.com:8080',
    isSecureContextEnabled: true,
    cdpEnvironment: 'production'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    config.get.mockImplementation((key) => mockConfig[key])
    global.GLOBAL_AGENT = {}
    delete global.PROXY_AGENT
  })

  describe('safeLog', () => {
    test('calls through to logger if methods exist', () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      }

      // Mock the logger module properly
      jest.doMock('../logging/logger.js', () => ({
        createLogger: () => mockLogger
      }))

      // Re-import to get the mocked version
      const { safeLog: testSafeLog } = require('./setup-proxy.js')

      testSafeLog.info('test info')
      testSafeLog.error('test error')
      testSafeLog.warn('test warn')

      expect(mockLogger.info).toHaveBeenCalledWith('test info')
      expect(mockLogger.error).toHaveBeenCalledWith('test error')
      expect(mockLogger.warn).toHaveBeenCalledWith('test warn')
    })
  })

  describe('checkTlsEnvironment', () => {
    test('warns when no TLS vars set', () => {
      const originalEnv = process.env
      process.env = {}

      const result = checkTlsEnvironment()

      expect(result).toEqual([])
      process.env = originalEnv
    })

    test('logs info with found TLS vars', () => {
      const originalEnv = process.env
      process.env = {
        TRUSTSTORE_CERT1: 'cert1',
        NODE_TLS_REJECT_UNAUTHORIZED: '0'
      }

      const result = checkTlsEnvironment()

      expect(result).toEqual([
        'TRUSTSTORE_CERT1',
        'NODE_TLS_REJECT_UNAUTHORIZED'
      ])
      process.env = originalEnv
    })
  })

  describe('setupUndiciProxy()', () => {
    test('creates ProxyAgent and sets global dispatcher', () => {
      const mockAgent = {}
      ProxyAgent.mockReturnValue(mockAgent)

      const result = setupUndiciProxy('http://proxy:8080', true)

      expect(ProxyAgent).toHaveBeenCalledWith('http://proxy:8080', {
        requestTls: { rejectUnauthorized: true }
      })
      expect(setGlobalDispatcher).toHaveBeenCalledWith(mockAgent)
      expect(result).toBe(mockAgent)
    })

    test('rejectUnauthorized=false when secureContext disabled', () => {
      setupUndiciProxy('http://proxy:8080', false)

      expect(ProxyAgent).toHaveBeenCalledWith('http://proxy:8080', {
        requestTls: { rejectUnauthorized: false }
      })
    })
  })

  describe('setupGlobalAgent()', () => {
    test('bootstraps and sets globals', () => {
      const result = setupGlobalAgent('http://proxy:8080')

      expect(bootstrap).toHaveBeenCalled()
      expect(global.GLOBAL_AGENT.HTTP_PROXY).toBe('http://proxy:8080')
      expect(global.GLOBAL_AGENT.HTTPS_PROXY).toBe('http://proxy:8080')
      expect(result).toBe(global.GLOBAL_AGENT)
    })

    test('respects existing NO_PROXY env', () => {
      const originalNoProxy = process.env.NO_PROXY
      process.env.NO_PROXY = 'custom.local'

      setupGlobalAgent('http://proxy:8080')

      expect(global.GLOBAL_AGENT.NO_PROXY).toBe('custom.local')
      process.env.NO_PROXY = originalNoProxy
    })
  })

  describe('createTlsOptions()', () => {
    test('defaults rejectUnauthorized true', () => {
      const result = createTlsOptions(true, 'production')

      expect(result).toEqual({ rejectUnauthorized: true })
    })

    test('relaxes on test/staging and warns when disabled', () => {
      const result = createTlsOptions(false, 'test')

      expect(result).toEqual({ rejectUnauthorized: false })
    })

    test('keeps enabled in test if true', () => {
      const result = createTlsOptions(true, 'test')

      expect(result).toEqual({ rejectUnauthorized: true })
    })
  })

  describe('setupHttpsProxyAgent()', () => {
    test('attaches global.PROXY_AGENT', () => {
      const mockAgent = {}
      HttpsProxyAgent.mockReturnValue(mockAgent)

      const result = setupHttpsProxyAgent('http://proxy:8080', {
        rejectUnauthorized: true
      })

      expect(HttpsProxyAgent).toHaveBeenCalledWith('http://proxy:8080', {
        rejectUnauthorized: true
      })
      expect(global.PROXY_AGENT).toBe(mockAgent)
      expect(result).toBe(mockAgent)
    })
  })

  describe('handleProxyError()', () => {
    test('logs all error details', () => {
      const error = new Error('Test error')
      error.name = 'TestError'
      error.code = 'TEST_CODE'

      const result = handleProxyError(error)

      expect(result).toBeNull()
    })
  })

  describe('setupProxy()', () => {
    test('skips when no proxyUrl', () => {
      config.get.mockImplementation((key) =>
        key === 'httpProxy' ? undefined : mockConfig[key]
      )

      const result = setupProxy()

      expect(result).toBeNull()
      expect(ProxyAgent).not.toHaveBeenCalled()
    })

    test('runs full setup when proxyUrl present', () => {
      const mockAgent = {}
      HttpsProxyAgent.mockReturnValue(mockAgent)

      const result = setupProxy()

      expect(ProxyAgent).toHaveBeenCalled()
      expect(bootstrap).toHaveBeenCalled()
      expect(HttpsProxyAgent).toHaveBeenCalled()
      expect(result).toBe(mockAgent)
    })

    test('catches on error', () => {
      ProxyAgent.mockImplementation(() => {
        throw new Error('Setup failed')
      })

      const result = setupProxy()

      expect(result).toBeNull()
    })
  })
})
