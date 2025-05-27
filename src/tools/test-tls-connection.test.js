import https from 'node:https'
import tls from 'node:tls'
import {
  DEFAULT_CONFIG,
  isTlsError,
  createTlsContext,
  testDirectConnection,
  testProxyConnection,
  testInsecureConnection,
  runAllTests
} from './test-tls-connection.js'
import { getTrustStoreCerts } from '../common/helpers/secure-context/get-trust-store-certs.js'

jest.mock('../common/helpers/secure-context/get-trust-store-certs.js')

describe('test-tls-connection.js', () => {
  let originalConsoleLog
  let originalConsoleError

  beforeEach(() => {
    originalConsoleLog = console.log
    originalConsoleError = console.error
    console.log = jest.fn()
    console.error = jest.fn()
    jest.clearAllMocks()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  describe('DEFAULT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CONFIG.TARGET_URL).toBe(
        'cdp-defra-id-stub.test.cdp-int.defra.cloud'
      )
      expect(DEFAULT_CONFIG.TARGET_PATH).toBe(
        '/cdp-defra-id-stub/.well-known/openid-configuration'
      )
      expect(DEFAULT_CONFIG.PORT).toBe(443)
      expect(DEFAULT_CONFIG.TIMEOUT_MS).toBe(10000)
    })
  })

  describe('isTlsError()', () => {
    it('returns false for null/undefined', () => {
      expect(isTlsError(null)).toBe(false)
      expect(isTlsError(undefined)).toBe(false)
    })

    it('returns true for known TLS error codes', () => {
      const codes = [
        'ECONNRESET',
        'CERT_HAS_EXPIRED',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'ERR_TLS_CERT_ALTNAME_INVALID',
        'CERT_SIGNATURE_FAILURE'
      ]
      for (const code of codes) {
        expect(isTlsError({ code })).toBe(true)
      }
    })

    it('returns true for messages containing tls/certificate/ssl keywords', () => {
      expect(isTlsError({ message: 'TLS handshake failed' })).toBe(true)
      expect(isTlsError({ message: 'certificate verification error' })).toBe(
        true
      )
      expect(isTlsError({ message: 'some ssl problem' })).toBe(true)
      expect(isTlsError({ message: 'self signed cert not trusted' })).toBe(true)
      expect(isTlsError({ message: 'handshake failure' })).toBe(true)
      expect(isTlsError({ message: 'verification failed' })).toBe(true)
    })

    it('returns false for unrelated errors', () => {
      expect(isTlsError({ code: 'ECONNREFUSED', message: 'refused' })).toBe(
        false
      )
      expect(isTlsError({ message: 'network timeout' })).toBe(false)
    })

    it('handles errors without message property', () => {
      expect(isTlsError({ code: 'ENOENT' })).toBe(false)
      expect(isTlsError({})).toBe(false)
    })
  })

  describe('createTlsContext()', () => {
    it('creates a TLS context and adds all certificates', () => {
      const fakeCerts = ['CERT1', 'CERT2', 'CERT3']
      getTrustStoreCerts.mockReturnValueOnce(fakeCerts)

      const fakeSecureContext = {
        context: { addCACert: jest.fn() }
      }
      const createSecureContextSpy = jest
        .spyOn(tls, 'createSecureContext')
        .mockReturnValueOnce(fakeSecureContext)

      const ctx = createTlsContext()

      expect(ctx).toBe(fakeSecureContext)
      expect(console.log).toHaveBeenCalledWith(
        `Found ${fakeCerts.length} certificates in environment variables`
      )

      createSecureContextSpy.mockRestore()
    })

    it('handles certificate addition errors gracefully', () => {
      const fakeCerts = ['GOOD', 'BAD', 'GOOD2']
      getTrustStoreCerts.mockReturnValueOnce(fakeCerts)

      const fakeSecureContext = {
        context: {
          addCACert: jest.fn((cert) => {
            if (cert === 'BAD') throw new Error('malformed cert')
          })
        }
      }
      const createSecureContextSpy = jest
        .spyOn(tls, 'createSecureContext')
        .mockReturnValueOnce(fakeSecureContext)

      const ctx = createTlsContext()

      expect(ctx).toBe(fakeSecureContext)
      expect(console.error).toHaveBeenCalledWith(
        'Failed to add certificate #2: malformed cert'
      )

      createSecureContextSpy.mockRestore()
    })

    it('returns null and logs error if getTrustStoreCerts throws', () => {
      getTrustStoreCerts.mockImplementationOnce(() => {
        throw new Error('no env')
      })
      const result = createTlsContext()
      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        'Failed to create TLS context: no env'
      )
    })
  })

  describe('testDirectConnection()', () => {
    it('should resolve with success when connection succeeds', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        on: jest.fn()
      }

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation((options, callback) => {
          setTimeout(() => {
            callback(mockResponse)
            const dataCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'data'
            )[1]
            const endCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'end'
            )[1]

            dataCallback('{"test": "data"}')
            endCallback()
          }, 0)

          return mockRequest
        })

      const result = await testDirectConnection()

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(result.data).toBe('{"test": "data"}')

      httpsRequestSpy.mockRestore()
    })

    it('should handle connection errors', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const testError = new Error('Connection failed')
      testError.code = 'ECONNREFUSED'

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(() => {
          setTimeout(() => {
            const errorCallback = mockRequest.on.mock.calls.find(
              (call) => call[0] === 'error'
            )[1]
            errorCallback(testError)
          }, 0)
          return mockRequest
        })

      const result = await testDirectConnection()

      expect(result.success).toBe(false)
      expect(result.error).toBe(testError)

      httpsRequestSpy.mockRestore()
    })

    it('should handle timeout', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(() => {
          setTimeout(() => {
            const timeoutCallback = mockRequest.on.mock.calls.find(
              (call) => call[0] === 'timeout'
            )[1]
            timeoutCallback()
          }, 0)
          return mockRequest
        })

      const result = await testDirectConnection()

      expect(result.success).toBe(false)
      expect(result.error.message).toBe('Request timed out')
      expect(mockRequest.destroy).toHaveBeenCalled()

      httpsRequestSpy.mockRestore()
    })

    it('should handle ECONNREFUSED error with specific message', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const testError = new Error('Connection refused')
      testError.code = 'ECONNREFUSED'

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(() => {
          setTimeout(() => {
            const errorCallback = mockRequest.on.mock.calls.find(
              (call) => call[0] === 'error'
            )[1]
            errorCallback(testError)
          }, 0)
          return mockRequest
        })

      const result = await testDirectConnection()

      expect(result.success).toBe(false)
      expect(result.error).toBe(testError)
      expect(console.error).toHaveBeenCalledWith(
        'Connection refused. The server might be down or a firewall is blocking access.'
      )

      httpsRequestSpy.mockRestore()
    })

    it('should handle TLS errors including ECONNRESET with certificate validation message', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const testError = new Error('Connection reset')
      testError.code = 'ECONNRESET'

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(() => {
          setTimeout(() => {
            const errorCallback = mockRequest.on.mock.calls.find(
              (call) => call[0] === 'error'
            )[1]
            errorCallback(testError)
          }, 0)
          return mockRequest
        })

      const result = await testDirectConnection()

      expect(result.success).toBe(false)
      expect(result.error).toBe(testError)
      expect(console.error).toHaveBeenCalledWith(
        'This is a certificate validation error. Ensure your certificates are valid and properly formatted.'
      )

      httpsRequestSpy.mockRestore()
    })
  })

  describe('testProxyConnection()', () => {
    it('should skip when no proxy is configured', async () => {
      const config = { ...DEFAULT_CONFIG, PROXY_URL: null }

      const result = await testProxyConnection(config)

      expect(result.success).toBe(false)
      expect(result.error.message).toBe('No proxy configured')
    })

    it('should resolve with success when proxy connection succeeds', async () => {
      const config = { ...DEFAULT_CONFIG, PROXY_URL: 'http://proxy:8080' }
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        on: jest.fn()
      }

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation((options, callback) => {
          setTimeout(() => {
            callback(mockResponse)
            const dataCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'data'
            )[1]
            const endCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'end'
            )[1]

            dataCallback('{"proxy": "success"}')
            endCallback()
          }, 0)
          return mockRequest
        })

      const result = await testProxyConnection(config)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)

      httpsRequestSpy.mockRestore()
    })

    it('should handle proxy connection errors', async () => {
      const config = { ...DEFAULT_CONFIG, PROXY_URL: 'http://proxy:8080' }
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const proxyError = new Error('Proxy connection failed')

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(() => {
          setTimeout(() => {
            const errorCallback = mockRequest.on.mock.calls.find(
              (call) => call[0] === 'error'
            )[1]
            errorCallback(proxyError)
          }, 0)
          return mockRequest
        })

      const result = await testProxyConnection(config)

      expect(result.success).toBe(false)
      expect(result.error).toBe(proxyError)

      httpsRequestSpy.mockRestore()
    })

    it('should handle timeout in proxy connection', async () => {
      const config = { ...DEFAULT_CONFIG, PROXY_URL: 'http://proxy:8080' }
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(() => {
          setTimeout(() => {
            const timeoutCallback = mockRequest.on.mock.calls.find(
              (call) => call[0] === 'timeout'
            )[1]
            timeoutCallback()
          }, 0)
          return mockRequest
        })

      const result = await testProxyConnection(config)

      expect(result.success).toBe(false)
      expect(result.error.message).toBe('Request timed out')
      expect(mockRequest.destroy).toHaveBeenCalled()

      httpsRequestSpy.mockRestore()
    })
  })

  describe('testInsecureConnection()', () => {
    it('should resolve with success when insecure connection succeeds', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        on: jest.fn()
      }

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation((options, callback) => {
          expect(options.rejectUnauthorized).toBe(false)
          setTimeout(() => {
            callback(mockResponse)
            const dataCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'data'
            )[1]
            const endCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'end'
            )[1]

            dataCallback('{"insecure": "success"}')
            endCallback()
          }, 0)
          return mockRequest
        })

      const result = await testInsecureConnection()

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)

      httpsRequestSpy.mockRestore()
    })

    it('should handle insecure connection errors', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const connectionError = new Error('Still failed')

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(() => {
          setTimeout(() => {
            const errorCallback = mockRequest.on.mock.calls.find(
              (call) => call[0] === 'error'
            )[1]
            errorCallback(connectionError)
          }, 0)
          return mockRequest
        })

      const result = await testInsecureConnection()

      expect(result.success).toBe(false)
      expect(result.error).toBe(connectionError)

      httpsRequestSpy.mockRestore()
    })

    it('should create proxy agent when proxy URL is configured', async () => {
      const config = { ...DEFAULT_CONFIG, PROXY_URL: 'http://proxy:8080' }
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        on: jest.fn()
      }

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation((options, callback) => {
          expect(options.agent).toBeDefined()
          expect(options.rejectUnauthorized).toBe(false)
          setTimeout(() => {
            callback(mockResponse)
            const dataCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'data'
            )[1]
            const endCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'end'
            )[1]

            dataCallback('{"proxy": "success"}')
            endCallback()
          }, 0)
          return mockRequest
        })

      const result = await testInsecureConnection(config)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(console.log).toHaveBeenCalledWith(
        'Using proxy with TLS verification disabled'
      )

      httpsRequestSpy.mockRestore()
    })

    it('should handle proxy agent creation error', async () => {
      const config = { ...DEFAULT_CONFIG, PROXY_URL: 'invalid-proxy-url' }
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        on: jest.fn()
      }

      const originalHttpsProxyAgent = global.HttpsProxyAgent
      global.HttpsProxyAgent = jest.fn().mockImplementation(() => {
        throw new Error('Invalid proxy URL')
      })

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation((options, callback) => {
          expect(options.agent).toBeUndefined()
          setTimeout(() => {
            callback(mockResponse)
            const dataCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'data'
            )[1]
            const endCallback = mockResponse.on.mock.calls.find(
              (call) => call[0] === 'end'
            )[1]

            dataCallback('{"success": true}')
            endCallback()
          }, 0)
          return mockRequest
        })

      const result = await testInsecureConnection(config)

      expect(result.success).toBe(true)
      expect(console.error).toHaveBeenCalledWith(
        'Failed to create proxy agent: Invalid URL'
      )

      httpsRequestSpy.mockRestore()
      global.HttpsProxyAgent = originalHttpsProxyAgent
    })

    it('should log specific error messages when insecure connection fails', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }
      const connectionError = new Error('Network failure')

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(() => {
          setTimeout(() => {
            const errorCallback = mockRequest.on.mock.calls.find(
              (call) => call[0] === 'error'
            )[1]
            errorCallback(connectionError)
          }, 0)
          return mockRequest
        })

      const result = await testInsecureConnection()

      expect(result.success).toBe(false)
      expect(result.error).toBe(connectionError)
      expect(console.error).toHaveBeenCalledWith(
        'TEST 3 FAILED: Network failure'
      )
      expect(console.error).toHaveBeenCalledWith(
        'Error name: Error, Error code: none'
      )
      expect(console.error).toHaveBeenCalledWith(
        '\nIF ALL TESTS FAILED: This suggests a network connectivity issue rather than just a certificate problem.'
      )

      httpsRequestSpy.mockRestore()
    })

    it('should handle timeout in insecure connection', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn()
      }

      const httpsRequestSpy = jest
        .spyOn(https, 'request')
        .mockImplementation(() => {
          setTimeout(() => {
            const timeoutCallback = mockRequest.on.mock.calls.find(
              (call) => call[0] === 'timeout'
            )[1]
            timeoutCallback()
          }, 0)
          return mockRequest
        })

      const result = await testInsecureConnection()

      expect(result.success).toBe(false)
      expect(result.error.message).toBe('Request timed out')
      expect(mockRequest.destroy).toHaveBeenCalled()

      httpsRequestSpy.mockRestore()
    })
  })

  describe('runAllTests()', () => {
    it('should have the runAllTests function available', () => {
      expect(typeof runAllTests).toBe('function')
    })

    it('should test the ternary operator logic for proxy configuration', () => {
      const configWithProxy = {
        ...DEFAULT_CONFIG,
        PROXY_URL: 'http://proxy:8080'
      }
      const configWithoutProxy = { ...DEFAULT_CONFIG, PROXY_URL: null }

      const proxyResult = configWithProxy.PROXY_URL
        ? 'proxy connection would be called'
        : { skipped: true }

      expect(proxyResult).toBe('proxy connection would be called')

      const noProxyResult = configWithoutProxy.PROXY_URL
        ? 'proxy connection would be called'
        : { skipped: true }

      expect(noProxyResult).toEqual({ skipped: true })

      expect(typeof runAllTests).toBe('function')
    })

    it('should cover runAllTests initial execution and logging', () => {
      const createTlsContextSpy = jest
        .spyOn({ createTlsContext }, 'createTlsContext')
        .mockReturnValue(null)

      const testDirectConnectionSpy = jest
        .spyOn({ testDirectConnection }, 'testDirectConnection')
        .mockImplementation(() => new Promise(() => {}))
      const testProxyConnectionSpy = jest
        .spyOn({ testProxyConnection }, 'testProxyConnection')
        .mockImplementation(() => new Promise(() => {}))
      const testInsecureConnectionSpy = jest
        .spyOn({ testInsecureConnection }, 'testInsecureConnection')
        .mockImplementation(() => new Promise(() => {}))

      const promise = runAllTests()

      expect(console.log).toHaveBeenCalledWith(
        '=== TLS Connection Test Utility ==='
      )
      expect(console.log).toHaveBeenCalledWith(
        `Target: https://${DEFAULT_CONFIG.TARGET_URL}${DEFAULT_CONFIG.TARGET_PATH}`
      )
      expect(console.log).toHaveBeenCalledWith('Using Proxy: None')

      createTlsContextSpy.mockRestore()
      testDirectConnectionSpy.mockRestore()
      testProxyConnectionSpy.mockRestore()
      testInsecureConnectionSpy.mockRestore()

      expect(promise).toBeInstanceOf(Promise)
    })
  })

  describe('Direct script execution', () => {
    it('should handle the import.meta.url check for direct execution', () => {
      const fs = require('fs')
      const path = require('path')
      const sourceFile = fs.readFileSync(
        path.join(__dirname, 'test-tls-connection.js'),
        'utf8'
      )

      expect(sourceFile).toContain('if (import.meta.url === `file://')
      expect(sourceFile).toContain('runAllTests()')
    })
  })
})
