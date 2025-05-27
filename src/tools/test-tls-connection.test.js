import { jest } from '@jest/globals'
import https from 'node:https'
import tls from 'node:tls'
import { EventEmitter } from 'node:events'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { getTrustStoreCerts } from '../common/helpers/secure-context/get-trust-store-certs.js'
import {
  DEFAULT_CONFIG,
  isTlsError,
  createTlsContext,
  testDirectConnection,
  testProxyConnection,
  testInsecureConnection,
  runAllTests
} from './test-tls-connection.js'

jest.mock('node:https')
jest.mock('node:tls')
jest.mock('https-proxy-agent')
jest.mock('../common/helpers/secure-context/get-trust-store-certs.js', () => ({
  getTrustStoreCerts: jest.fn()
}))

describe('test-tls-connection.js', () => {
  const originalConsoleLog = console.log
  const originalConsoleError = console.error

  beforeEach(() => {
    console.log = jest.fn()
    console.error = jest.fn()

    jest.clearAllMocks()

    getTrustStoreCerts.mockReturnValue(['CERT1', 'CERT2'])

    const mockContext = {
      addCACert: jest.fn()
    }
    tls.createSecureContext.mockReturnValue({
      context: mockContext
    })
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  function setupMockResponse() {
    const mockResponse = new EventEmitter()
    mockResponse.statusCode = 200
    mockResponse.headers = { 'content-type': 'application/json' }

    const mockRequest = new EventEmitter()
    mockRequest.end = jest.fn(() => {
      process.nextTick(() => {
        mockResponse.emit('data', Buffer.from('{"test":"data"}'))
        mockResponse.emit('end')
      })
    })
    mockRequest.destroy = jest.fn()

    https.request.mockImplementation((options, callback) => {
      if (callback) {
        process.nextTick(() => callback(mockResponse))
      }
      return mockRequest
    })

    return { mockRequest, mockResponse }
  }

  describe('isTlsError', () => {
    test('should identify TLS errors by code', () => {
      const error = new Error('TLS error')
      error.code = 'ECONNRESET'

      expect(isTlsError(error)).toBe(true)
    })

    test('should identify TLS errors by message', () => {
      const error = new Error('certificate verification failed')
      expect(isTlsError(error)).toBe(true)
    })

    test('should return false for non-TLS errors', () => {
      const error = new Error('Some other error')
      error.code = 'ENOTFOUND'

      expect(isTlsError(error)).toBe(false)
    })

    test('should handle null error', () => {
      expect(isTlsError(null)).toBe(false)
    })
  })

  describe('createTlsContext', () => {
    test('should create TLS context with certificates', () => {
      const secureContext = createTlsContext()

      expect(getTrustStoreCerts).toHaveBeenCalled()
      expect(tls.createSecureContext).toHaveBeenCalled()
      expect(secureContext.context.addCACert).toHaveBeenCalledTimes(2)
      expect(console.log).toHaveBeenCalledWith(
        'TLS context created successfully'
      )
    })

    test('should handle errors during certificate loading', () => {
      const mockContext = {
        addCACert: jest
          .fn()
          .mockImplementationOnce(() => {})
          .mockImplementationOnce(() => {
            throw new Error('Invalid cert')
          })
      }
      tls.createSecureContext.mockReturnValue({
        context: mockContext
      })

      const secureContext = createTlsContext()

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add certificate #2')
      )
      expect(secureContext).toBeTruthy()
    })

    test('should handle errors from getTrustStoreCerts', () => {
      getTrustStoreCerts.mockImplementation(() => {
        throw new Error('Cannot read environment variables')
      })

      const secureContext = createTlsContext()

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create TLS context')
      )
      expect(secureContext).toBeNull()
    })
  })

  describe('testDirectConnection', () => {
    test('should successfully test direct connection', async () => {
      setupMockResponse()

      const result = await testDirectConnection()

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(result.data).toBe('{"test":"data"}')
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: DEFAULT_CONFIG.TARGET_URL,
          path: DEFAULT_CONFIG.TARGET_PATH
        }),
        expect.any(Function)
      )
    })

    test('should handle connection errors', async () => {
      const mockError = new Error('Connection failed')
      mockError.code = 'ECONNREFUSED'

      const mockRequest = new EventEmitter()
      mockRequest.end = jest.fn(() => {
        process.nextTick(() => mockRequest.emit('error', mockError))
      })
      mockRequest.destroy = jest.fn()

      https.request.mockReturnValue(mockRequest)

      const result = await testDirectConnection()

      expect(result.success).toBe(false)
      expect(result.error).toBe(mockError)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('TEST 1 FAILED')
      )
    })

    test('should handle TLS errors', async () => {
      const mockError = new Error('Certificate verification failed')
      mockError.code = 'CERT_HAS_EXPIRED'

      const mockRequest = new EventEmitter()
      mockRequest.end = jest.fn(() => {
        process.nextTick(() => mockRequest.emit('error', mockError))
      })
      mockRequest.destroy = jest.fn()

      https.request.mockReturnValue(mockRequest)

      const result = await testDirectConnection()

      expect(result.success).toBe(false)
      expect(result.error).toBe(mockError)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('certificate validation error')
      )
    })

    test('should handle timeouts', async () => {
      const mockRequest = new EventEmitter()
      mockRequest.end = jest.fn(() => {
        process.nextTick(() => mockRequest.emit('timeout'))
      })
      mockRequest.destroy = jest.fn()

      https.request.mockReturnValue(mockRequest)

      const result = await testDirectConnection()

      expect(result.success).toBe(false)
      expect(result.error.message).toBe('Request timed out')
      expect(mockRequest.destroy).toHaveBeenCalled()
    })
  })

  describe('testProxyConnection', () => {
    test('should skip test when no proxy is configured', async () => {
      const config = { ...DEFAULT_CONFIG, PROXY_URL: null }

      const result = await testProxyConnection(config)

      expect(result.success).toBe(false)
      expect(result.error.message).toBe('No proxy configured')
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Skipped (no proxy configured)')
      )
    })

    test('should test connection through proxy', async () => {
      setupMockResponse()

      const mockAgent = {}
      HttpsProxyAgent.mockReturnValue(mockAgent)

      const config = { ...DEFAULT_CONFIG, PROXY_URL: 'http://proxy:8080' }

      const result = await testProxyConnection(config)

      expect(HttpsProxyAgent).toHaveBeenCalledWith(
        'http://proxy:8080',
        expect.objectContaining({ rejectUnauthorized: true })
      )
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: mockAgent
        }),
        expect.any(Function)
      )
      expect(result.success).toBe(true)
    })

    test('should handle proxy connection errors', async () => {
      const mockError = new Error('Proxy connection failed')
      HttpsProxyAgent.mockImplementation(() => {
        throw mockError
      })

      const config = { ...DEFAULT_CONFIG, PROXY_URL: 'http://proxy:8080' }

      const result = await testProxyConnection(config)

      expect(result.success).toBe(false)
      expect(result.error).toBe(mockError)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('TEST 2 FAILED during setup')
      )
    })
  })

  describe('testInsecureConnection', () => {
    test('should test connection with TLS verification disabled', async () => {
      setupMockResponse()

      const result = await testInsecureConnection()

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          rejectUnauthorized: false
        }),
        expect.any(Function)
      )
      expect(result.success).toBe(true)
    })

    test('should use proxy with TLS verification disabled when proxy is configured', async () => {
      setupMockResponse()

      const mockAgent = {}
      HttpsProxyAgent.mockReturnValue(mockAgent)

      const config = { ...DEFAULT_CONFIG, PROXY_URL: 'http://proxy:8080' }

      await testInsecureConnection(config)

      expect(HttpsProxyAgent).toHaveBeenCalledWith(
        'http://proxy:8080',
        expect.objectContaining({ rejectUnauthorized: false })
      )
      expect(console.log).toHaveBeenCalledWith(
        'Using proxy with TLS verification disabled'
      )
    })
  })

  describe('runAllTests', () => {
    beforeEach(() => {
      setupMockResponse()
    })

    test('should run all tests and return results', async () => {
      const results = await runAllTests()

      expect(results).toHaveProperty('directConnection')
      expect(results).toHaveProperty('proxyConnection')
      expect(results).toHaveProperty('insecureConnection')

      expect(results.directConnection.success).toBe(true)
      expect(results.proxyConnection).toHaveProperty('skipped', true)
      expect(results.insecureConnection.success).toBe(true)
    })

    test('should run proxy test when proxy is configured', async () => {
      const mockAgent = {}
      HttpsProxyAgent.mockReturnValue(mockAgent)

      const config = { ...DEFAULT_CONFIG, PROXY_URL: 'http://proxy:8080' }

      const results = await runAllTests(config)

      expect(results.proxyConnection.success).toBe(true)
      expect(results.proxyConnection).not.toHaveProperty('skipped')
    })
  })
})
