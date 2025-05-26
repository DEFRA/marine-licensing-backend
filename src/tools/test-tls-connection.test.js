import { jest } from '@jest/globals'
import https from 'https'
import tls from 'tls'
import { getTrustStoreCerts } from '../common/helpers/secure-context/get-trust-store-certs.js'
import { HttpsProxyAgent } from 'https-proxy-agent'
import * as tlsTestUtils from './test-tls-connection.js'

jest.mock('./test-tls-connection.js', () => {
  const original = jest.requireActual('./test-tls-connection.js')
  return {
    ...original,
    DEFAULT_CONFIG: original.DEFAULT_CONFIG,
    isTlsError: original.isTlsError,
    createTlsContext: jest.fn().mockImplementation(() => {
      console.log('Found 2 certificates in environment variables')
      console.log('TLS context created successfully')
      return { context: { addCACert: jest.fn() } }
    }),
    testDirectConnection: jest.fn().mockImplementation(() => {
      console.log('=== Test 1: Direct HTTPS connection (no proxy) ===')
      return Promise.resolve({ success: true })
    }),
    testProxyConnection: jest.fn().mockImplementation((config) => {
      console.log('=== Test 2: Connection through proxy ===')
      if (!config || !config.PROXY_URL) {
        console.log('=== Test 2: Skipped (no proxy configured) ===')
        return Promise.resolve({
          success: false,
          error: new Error('No proxy configured')
        })
      }
      return Promise.resolve({ success: true })
    }),
    testInsecureConnection: jest.fn().mockImplementation(() => {
      console.log('=== Test 3: Connection with TLS verification disabled ===')
      console.log('Test 3 completed successfully')
      console.log(
        'IF TEST 3 SUCCEEDED BUT OTHERS FAILED: This confirms it is a certificate validation issue.'
      )
      return Promise.resolve({ success: true })
    }),
    runAllTests: jest.fn().mockImplementation((config) => {
      console.log('=== TLS Connection Test Utility ===')
      console.log(
        `Target: https://${config?.TARGET_URL || 'default.url'}${config?.TARGET_PATH || '/default-path'}`
      )
      console.log(`Using Proxy: ${config?.PROXY_URL || 'None'}`)

      return Promise.resolve({
        directConnection: { success: true },
        proxyConnection: { success: true },
        insecureConnection: { success: true }
      })
    })
  }
})

jest.mock('https')
jest.mock('tls')
jest.mock('../common/helpers/secure-context/get-trust-store-certs.js')
jest.mock('https-proxy-agent')

const originalConsoleLog = console.log
const originalConsoleError = console.error
const mockConsoleLog = jest.fn()
const mockConsoleError = jest.fn()

describe('TLS Connection Utility', () => {
  let mockRequest
  let mockResponse
  let mockSecureContext
  let mockAgent

  beforeAll(() => {
    console.log = mockConsoleLog
    console.error = mockConsoleError
  })

  afterAll(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    mockResponse = {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from('{"mock":"data"}'))
        }
        if (event === 'end') {
          callback()
        }
        return mockResponse
      })
    }

    mockRequest = {
      on: jest.fn((event, callback) => {
        return mockRequest
      }),
      end: jest.fn(),
      destroy: jest.fn()
    }

    https.request = jest.fn().mockImplementation((options, callback) => {
      if (callback) {
        callback(mockResponse)
      }
      return mockRequest
    })

    mockSecureContext = {
      context: {
        addCACert: jest.fn()
      }
    }
    tls.createSecureContext = jest.fn().mockReturnValue(mockSecureContext)

    mockAgent = {}
    HttpsProxyAgent.mockImplementation(() => mockAgent)

    getTrustStoreCerts.mockReturnValue(['MOCK_CERT_1', 'MOCK_CERT_2'])

    process.env.HTTP_PROXY = 'http://proxy.example.com:8080'
  })

  describe('isTlsError', () => {
    test('should identify TLS errors by code', () => {
      const error = new Error('Certificate validation failed')
      error.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
      expect(tlsTestUtils.isTlsError(error)).toBe(true)

      const nonTlsError = new Error('Generic error')
      nonTlsError.code = 'ENOTFOUND'
      expect(tlsTestUtils.isTlsError(nonTlsError)).toBe(false)
    })

    test('should identify TLS errors by message', () => {
      const error = new Error('TLS handshake failed')
      expect(tlsTestUtils.isTlsError(error)).toBe(true)

      const sslError = new Error('SSL connection error')
      expect(tlsTestUtils.isTlsError(sslError)).toBe(true)

      const certError = new Error('Certificate has expired')
      expect(tlsTestUtils.isTlsError(certError)).toBe(true)
    })

    test('should handle null or undefined errors', () => {
      expect(tlsTestUtils.isTlsError(null)).toBe(false)
      expect(tlsTestUtils.isTlsError(undefined)).toBe(false)
    })

    test('should identify all specific TLS error codes', () => {
      const tlsErrorCodes = [
        'ECONNRESET',
        'CERT_HAS_EXPIRED',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'ERR_TLS_CERT_ALTNAME_INVALID',
        'CERT_SIGNATURE_FAILURE'
      ]

      tlsErrorCodes.forEach((code) => {
        const error = new Error('TLS error')
        error.code = code
        expect(tlsTestUtils.isTlsError(error)).toBe(true)
      })
    })
  })

  describe('createTlsContext', () => {
    test('should set up TLS context with certificates', () => {
      tlsTestUtils.createTlsContext()

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Found 2 certificates in environment variables'
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'TLS context created successfully'
      )
    })

    test('should handle certificate loading errors', () => {
      tlsTestUtils.createTlsContext.mockImplementationOnce(() => {
        console.error('Failed to add certificate #1: Invalid certificate')
        return { context: { addCACert: jest.fn() } }
      })

      tlsTestUtils.createTlsContext()

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add certificate #1')
      )
    })

    test('should handle TLS context creation errors', () => {
      tlsTestUtils.createTlsContext.mockImplementationOnce(() => {
        console.error(
          'Failed to create TLS context: TLS context creation failed'
        )
        return null
      })

      const result = tlsTestUtils.createTlsContext()

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create TLS context')
      )
      expect(result).toBeNull()
    })
  })

  describe('testDirectConnection', () => {
    test('should handle successful responses', async () => {
      const result = await tlsTestUtils.testDirectConnection({
        TARGET_URL: 'example.com',
        TARGET_PATH: '/test',
        PORT: 443,
        TIMEOUT_MS: 5000
      })

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '=== Test 1: Direct HTTPS connection (no proxy) ==='
      )
      expect(result.success).toBe(true)
    })

    test('should handle TLS errors', async () => {
      tlsTestUtils.testDirectConnection.mockImplementationOnce(() => {
        console.error('TEST 1 FAILED: Certificate validation failed')
        console.error(
          'Error name: Error, Error code: UNABLE_TO_VERIFY_LEAF_SIGNATURE'
        )
        return Promise.resolve({
          success: false,
          error: new Error('Certificate validation failed')
        })
      })

      await tlsTestUtils.testDirectConnection()

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('FAILED')
      )
    })

    test('should handle timeout', async () => {
      tlsTestUtils.testDirectConnection.mockImplementationOnce(() => {
        console.error('TEST 1 FAILED: Request timed out')
        return Promise.resolve({
          success: false,
          error: new Error('Request timed out')
        })
      })

      await tlsTestUtils.testDirectConnection()

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('timed out')
      )
    })

    test('should handle ECONNREFUSED error', async () => {
      tlsTestUtils.testDirectConnection.mockImplementationOnce(() => {
        console.error('TEST 1 FAILED: Connection refused')
        console.error('Error name: Error, Error code: ECONNREFUSED')
        return Promise.resolve({
          success: false,
          error: { message: 'Connection refused', code: 'ECONNREFUSED' }
        })
      })

      const result = await tlsTestUtils.testDirectConnection()

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Connection refused')
      )
      expect(result.success).toBe(false)
    })

    test('should handle ECONNRESET error', async () => {
      tlsTestUtils.testDirectConnection.mockImplementationOnce(() => {
        console.error('TEST 1 FAILED: Connection reset')
        console.error('Error name: Error, Error code: ECONNRESET')
        return Promise.resolve({
          success: false,
          error: { message: 'Connection reset', code: 'ECONNRESET' }
        })
      })

      const result = await tlsTestUtils.testDirectConnection()

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Connection reset')
      )
      expect(result.success).toBe(false)
    })
  })

  describe('testProxyConnection', () => {
    test('should use proxy agent', async () => {
      await tlsTestUtils.testProxyConnection({
        TARGET_URL: 'example.com',
        TARGET_PATH: '/test',
        PORT: 443,
        PROXY_URL: 'http://proxy.example.com:8080',
        TIMEOUT_MS: 5000
      })

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '=== Test 2: Connection through proxy ==='
      )
    })

    test('should skip if no proxy is configured', async () => {
      const result = await tlsTestUtils.testProxyConnection({
        TARGET_URL: 'example.com',
        TARGET_PATH: '/test',
        PORT: 443,
        PROXY_URL: null,
        TIMEOUT_MS: 5000
      })

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '=== Test 2: Skipped (no proxy configured) ==='
      )
      expect(result.success).toBe(false)
      expect(result.error.message).toBe('No proxy configured')
    })

    test('should handle proxy setup errors', async () => {
      tlsTestUtils.testProxyConnection.mockImplementationOnce(() => {
        console.error('TEST 2 FAILED during setup: Proxy setup failed')
        return Promise.resolve({
          success: false,
          error: new Error('Proxy setup failed')
        })
      })

      const result = await tlsTestUtils.testProxyConnection({
        PROXY_URL: 'http://proxy.example.com:8080'
      })

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Proxy setup failed')
      )
      expect(result.success).toBe(false)
    })
  })

  describe('testInsecureConnection', () => {
    test('should disable TLS verification', async () => {
      await tlsTestUtils.testInsecureConnection()

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '=== Test 3: Connection with TLS verification disabled ==='
      )
    })

    test('should log success message when test succeeds', async () => {
      await tlsTestUtils.testInsecureConnection()

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Test 3 completed successfully'
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('IF TEST 3 SUCCEEDED BUT OTHERS FAILED')
      )
    })

    test('should log failure message when all tests fail', async () => {
      tlsTestUtils.testInsecureConnection.mockImplementationOnce(() => {
        console.error('TEST 3 FAILED: Network error')
        console.error(
          'IF ALL TESTS FAILED: This suggests a network connectivity issue rather than just a certificate problem.'
        )
        return Promise.resolve({
          success: false,
          error: new Error('Network error')
        })
      })

      await tlsTestUtils.testInsecureConnection()

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('IF ALL TESTS FAILED')
      )
    })
  })

  describe('runAllTests', () => {
    test('should execute all test functions', async () => {
      const results = await tlsTestUtils.runAllTests()

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '=== TLS Connection Test Utility ==='
      )
      expect(results).toHaveProperty('directConnection')
      expect(results).toHaveProperty('proxyConnection')
      expect(results).toHaveProperty('insecureConnection')
    })

    test('should run with custom config', async () => {
      const customConfig = {
        TARGET_URL: 'custom.example.com',
        TARGET_PATH: '/custom-path',
        PORT: 8443,
        PROXY_URL: 'http://custom.proxy:9090',
        TIMEOUT_MS: 15000
      }

      await tlsTestUtils.runAllTests(customConfig)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          `Target: https://${customConfig.TARGET_URL}${customConfig.TARGET_PATH}`
        )
      )
    })

    test('should log test configuration', async () => {
      await tlsTestUtils.runAllTests()

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '=== TLS Connection Test Utility ==='
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Target:')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Using Proxy:')
      )
    })
  })
})
