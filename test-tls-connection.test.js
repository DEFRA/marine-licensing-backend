import { jest } from '@jest/globals'
import https from 'node:https'
import tls from 'node:tls'
import { getTrustStoreCerts } from './src/common/helpers/secure-context/get-trust-store-certs.js'
import { HttpsProxyAgent } from 'https-proxy-agent'

jest.mock('node:https')
jest.mock('node:tls')
jest.mock('./src/common/helpers/secure-context/get-trust-store-certs.js')
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

  test('should load and use trust store certificates', async () => {
    await import('./test-tls-connection.js')

    expect(getTrustStoreCerts).toHaveBeenCalled()
    expect(mockConsoleLog).toHaveBeenCalledWith(
      'Found 2 certificates in environment variables'
    )

    expect(tls.createSecureContext).toHaveBeenCalled()
    expect(mockSecureContext.context.addCACert).toHaveBeenCalledTimes(2)
  })

  test('should handle certificate loading errors gracefully', async () => {
    mockSecureContext.context.addCACert.mockImplementationOnce(() => {
      throw new Error('Invalid certificate')
    })

    await import('./test-tls-connection.js')

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to add certificate #1')
    )
  })

  test('should handle TLS context creation errors gracefully', async () => {
    tls.createSecureContext.mockImplementationOnce(() => {
      throw new Error('TLS context creation failed')
    })

    await import('./test-tls-connection.js')

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create TLS context')
    )
  })

  test('should set up proxy connection when PROXY_URL is available', async () => {
    await import('./test-tls-connection.js')

    expect(HttpsProxyAgent).toHaveBeenCalled()
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Connection through proxy')
    )
  })

  test('should handle network errors in direct connection gracefully', async () => {
    const networkError = new Error('Connection refused')
    networkError.code = 'ECONNREFUSED'

    mockRequest.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        callback(networkError)
      }
      return mockRequest
    })

    await import('./test-tls-connection.js')

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('TEST 1 FAILED')
    )
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Connection refused')
    )
  })

  test('should handle certificate validation errors gracefully', async () => {
    const certError = new Error('Certificate validation failed')
    certError.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'

    mockRequest.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        callback(certError)
      }
      return mockRequest
    })

    await import('./test-tls-connection.js')

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('certificate validation error')
    )
  })

  test('should handle timeouts gracefully', async () => {
    mockRequest.on.mockImplementation((event, callback) => {
      if (event === 'timeout') {
        callback()
      }
      return mockRequest
    })

    await import('./test-tls-connection.js')

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Request timed out')
    )
    expect(mockRequest.destroy).toHaveBeenCalled()
  })
})
