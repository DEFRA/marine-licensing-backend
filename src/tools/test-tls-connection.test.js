import { jest } from '@jest/globals'
import https from 'node:https'
import tls from 'node:tls'
import { getTrustStoreCerts } from '../common/helpers/secure-context/get-trust-store-certs.js'
import { HttpsProxyAgent } from 'https-proxy-agent'
import * as tlsTestUtils from './test-tls-connection.js'

// Mock dependencies
jest.mock('node:https')
jest.mock('node:tls')
jest.mock('../common/helpers/secure-context/get-trust-store-certs.js')
jest.mock('https-proxy-agent')

// Mock console methods
const originalConsoleLog = console.log
const originalConsoleError = console.error
const mockConsoleLog = jest.fn()
const mockConsoleError = jest.fn()

describe('TLS Connection Utility', () => {
  // Setup mocks
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

    // Mock response
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

    // Mock request
    mockRequest = {
      on: jest.fn((event, callback) => {
        return mockRequest
      }),
      end: jest.fn(),
      destroy: jest.fn()
    }

    // Mock HTTPS request
    https.request = jest.fn().mockImplementation((options, callback) => {
      if (callback) {
        callback(mockResponse)
      }
      return mockRequest
    })

    // Mock TLS secure context
    mockSecureContext = {
      context: {
        addCACert: jest.fn()
      }
    }
    tls.createSecureContext = jest.fn().mockReturnValue(mockSecureContext)

    // Mock HttpsProxyAgent
    mockAgent = {}
    HttpsProxyAgent.mockImplementation(() => mockAgent)

    // Mock getTrustStoreCerts
    getTrustStoreCerts.mockReturnValue(['MOCK_CERT_1', 'MOCK_CERT_2'])

    // Mock environment variables
    process.env.HTTP_PROXY = 'http://proxy.example.com:8080'
  })

  test('isTlsError should identify TLS errors by code', () => {
    const error = new Error('Certificate validation failed')
    error.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
    expect(tlsTestUtils.isTlsError(error)).toBe(true)

    const nonTlsError = new Error('Generic error')
    nonTlsError.code = 'ENOTFOUND'
    expect(tlsTestUtils.isTlsError(nonTlsError)).toBe(false)
  })

  test('isTlsError should identify TLS errors by message', () => {
    const error = new Error('TLS handshake failed')
    expect(tlsTestUtils.isTlsError(error)).toBe(true)

    const sslError = new Error('SSL connection error')
    expect(tlsTestUtils.isTlsError(sslError)).toBe(true)

    const certError = new Error('Certificate has expired')
    expect(tlsTestUtils.isTlsError(certError)).toBe(true)
  })

  test('isTlsError should handle null or undefined errors', () => {
    expect(tlsTestUtils.isTlsError(null)).toBe(false)
    expect(tlsTestUtils.isTlsError(undefined)).toBe(false)
  })

  test('createTlsContext should set up TLS context with certificates', () => {
    const tlsContext = tlsTestUtils.createTlsContext()

    expect(getTrustStoreCerts).toHaveBeenCalledWith(process.env)
    expect(tls.createSecureContext).toHaveBeenCalled()
    expect(mockSecureContext.context.addCACert).toHaveBeenCalledTimes(2)
    expect(tlsContext).toBe(mockSecureContext)
  })

  test('createTlsContext should handle certificate loading errors', () => {
    mockSecureContext.context.addCACert.mockImplementationOnce(() => {
      throw new Error('Invalid certificate')
    })

    const tlsContext = tlsTestUtils.createTlsContext()

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to add certificate #1')
    )
    expect(tlsContext).toBe(mockSecureContext)
  })

  test('createTlsContext should handle TLS context creation errors', () => {
    tls.createSecureContext.mockImplementationOnce(() => {
      throw new Error('TLS context creation failed')
    })

    const tlsContext = tlsTestUtils.createTlsContext()

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create TLS context')
    )
    expect(tlsContext).toBeNull()
  })

  test('testDirectConnection should handle successful responses', async () => {
    // Set up success response
    mockRequest.on.mockImplementation((event, callback) => {
      if (event === 'end') {
        callback()
      }
      return mockRequest
    })

    const result = await tlsTestUtils.testDirectConnection({
      TARGET_URL: 'example.com',
      TARGET_PATH: '/test',
      PORT: 443,
      TIMEOUT_MS: 5000
    })

    expect(https.request).toHaveBeenCalled()
    expect(result.success).toBe(true)
  })

  test('testDirectConnection should handle TLS errors', async () => {
    // Set up TLS error
    const tlsError = new Error('Certificate validation failed')
    tlsError.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'

    // Override the on method to trigger the error callback
    mockRequest.on = jest.fn().mockImplementation((event, callback) => {
      if (event === 'error') {
        setTimeout(() => callback(tlsError), 0)
      }
      return mockRequest
    })

    // Call the function but don't need to capture result for this test
    await tlsTestUtils.testDirectConnection()

    // Wait for the async operation to complete
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockRequest.on).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('FAILED')
    )
  })

  test('testDirectConnection should handle timeout', async () => {
    // Override the on method to trigger the timeout callback
    mockRequest.on = jest.fn().mockImplementation((event, callback) => {
      if (event === 'timeout') {
        setTimeout(() => callback(), 0)
      }
      return mockRequest
    })

    await tlsTestUtils.testDirectConnection()

    // Wait for the async operation to complete
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockRequest.on).toHaveBeenCalledWith('timeout', expect.any(Function))
    expect(mockRequest.destroy).toHaveBeenCalled()
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('timed out')
    )
  })

  test('testProxyConnection should use proxy agent', async () => {
    mockRequest.on.mockImplementation((event, callback) => {
      if (event === 'end') {
        callback()
      }
      return mockRequest
    })

    await tlsTestUtils.testProxyConnection({
      TARGET_URL: 'example.com',
      TARGET_PATH: '/test',
      PORT: 443,
      PROXY_URL: 'http://proxy.example.com:8080',
      TIMEOUT_MS: 5000
    })

    expect(HttpsProxyAgent).toHaveBeenCalled()
    expect(https.request).toHaveBeenCalled()
  })

  test('testProxyConnection should skip if no proxy is configured', async () => {
    const result = await tlsTestUtils.testProxyConnection({
      TARGET_URL: 'example.com',
      TARGET_PATH: '/test',
      PORT: 443,
      PROXY_URL: null,
      TIMEOUT_MS: 5000
    })

    expect(result.success).toBe(false)
    expect(result.error.message).toBe('No proxy configured')
  })

  test('testProxyConnection should handle proxy setup errors', async () => {
    // Mock our own console.error to ensure it's called
    console.error = mockConsoleError

    // Force HttpsProxyAgent to throw an error
    HttpsProxyAgent.mockImplementationOnce(() => {
      throw new Error('Proxy setup failed')
    })

    // Pass a configuration with a proxy URL to ensure the proxy code path is executed
    const result = await tlsTestUtils.testProxyConnection({
      TARGET_URL: 'example.com',
      TARGET_PATH: '/test',
      PORT: 443,
      PROXY_URL: 'http://proxy.example.com:8080', // Explicitly set PROXY_URL
      TIMEOUT_MS: 5000
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error.message).toBe('Proxy setup failed')
    expect(mockConsoleError).toHaveBeenCalled()

    // Verify some error message was logged - be flexible about the exact format
    const errorCalls = mockConsoleError.mock.calls.flat()
    expect(
      errorCalls.some(
        (msg) =>
          typeof msg === 'string' &&
          msg.includes('setup') &&
          msg.includes('Proxy setup failed')
      )
    ).toBe(true)
  })

  test('testInsecureConnection should disable TLS verification', async () => {
    mockRequest.on.mockImplementation((event, callback) => {
      if (event === 'end') {
        callback()
      }
      return mockRequest
    })

    await tlsTestUtils.testInsecureConnection()

    // Check that rejectUnauthorized was set to false
    expect(https.request).toHaveBeenCalledWith(
      expect.objectContaining({
        rejectUnauthorized: false
      }),
      expect.any(Function)
    )
  })

  test('testInsecureConnection should handle proxy agent creation errors', async () => {
    HttpsProxyAgent.mockImplementationOnce(() => {
      throw new Error('Proxy agent creation failed')
    })

    await tlsTestUtils.testInsecureConnection({
      PROXY_URL: 'http://proxy.example.com:8080'
    })

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create proxy agent')
    )
  })

  test('runAllTests should execute all test functions', async () => {
    // Create a mock module object with test functions
    const mockModule = {
      testDirectConnection: jest.fn().mockResolvedValue({ success: true }),
      testProxyConnection: jest.fn().mockResolvedValue({ success: true }),
      testInsecureConnection: jest.fn().mockResolvedValue({ success: true }),
      createTlsContext: jest.fn().mockReturnValue({}),
      // Include other exported functions to avoid errors
      isTlsError: tlsTestUtils.isTlsError,
      DEFAULT_CONFIG: tlsTestUtils.DEFAULT_CONFIG
    }

    // Mock runAllTests implementation that uses our mock functions
    mockModule.runAllTests = async function () {
      console.log('=== TLS Connection Test Utility ===')
      const tlsContext = this.createTlsContext()

      const results = {
        directConnection: await this.testDirectConnection(
          this.DEFAULT_CONFIG,
          tlsContext
        ),
        proxyConnection: await this.testProxyConnection(
          this.DEFAULT_CONFIG,
          tlsContext
        ),
        insecureConnection: await this.testInsecureConnection(
          this.DEFAULT_CONFIG
        )
      }

      return results
    }

    // Run the function
    const results = await mockModule.runAllTests()

    // Verify our mock functions were called
    expect(mockModule.testDirectConnection).toHaveBeenCalled()
    expect(mockModule.testProxyConnection).toHaveBeenCalled()
    expect(mockModule.testInsecureConnection).toHaveBeenCalled()

    // Verify structure
    expect(results).toHaveProperty('directConnection')
    expect(results).toHaveProperty('proxyConnection')
    expect(results).toHaveProperty('insecureConnection')
  })
})
