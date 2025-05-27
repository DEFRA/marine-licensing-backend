import {
  safeLog,
  checkTlsEnvironment,
  setupUndiciProxy,
  setupGlobalAgent,
  createTlsOptions,
  setupHttpsProxyAgent,
  handleProxyError,
  setupProxy
} from './setup-proxy.js'

import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { bootstrap } from 'global-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { config } from '../../../config.js'
import { isTlsError } from './tls-error.js'

jest.mock('undici', () => ({
  ProxyAgent: jest.fn(),
  setGlobalDispatcher: jest.fn()
}))
jest.mock('global-agent', () => ({ bootstrap: jest.fn() }))
jest.mock('https-proxy-agent', () => ({ HttpsProxyAgent: jest.fn() }))
jest.mock('../../../config.js', () => ({
  config: { get: jest.fn() }
}))
jest.mock('./tls-error.js', () => ({
  isTlsError: jest.fn()
}))

jest.mock('../logging/logger.js', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}))

describe('setup-proxy', () => {
  const origEnv = process.env
  let infoSpy, warnSpy, errorSpy

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...origEnv }

    infoSpy = jest.spyOn(safeLog, 'info')
    warnSpy = jest.spyOn(safeLog, 'warn')
    errorSpy = jest.spyOn(safeLog, 'error')

    global.GLOBAL_AGENT = {
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      NO_PROXY: ''
    }
  })

  afterAll(() => {
    process.env = origEnv
  })

  describe('safeLog', () => {
    it('calls through to logger if methods exist', () => {
      safeLog.info('hello')
      expect(infoSpy).toHaveBeenCalledWith('hello')
      safeLog.warn('yo')
      expect(warnSpy).toHaveBeenCalledWith('yo')
      safeLog.error('err')
      expect(errorSpy).toHaveBeenCalledWith('err')
    })
  })

  describe('checkTlsEnvironment', () => {
    it('warns when no TLS vars set', () => {
      delete process.env.TRUSTSTORE_PATH
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
      delete process.env.ENABLE_SECURE_CONTEXT
      const vars = checkTlsEnvironment()
      expect(vars).toHaveLength(0)
      expect(warnSpy).toHaveBeenCalledWith(
        'No TLS environment variables found, which may cause certificate validation issues'
      )
    })

    it('logs info with found TLS vars', () => {
      process.env.TRUSTSTORE_PATH = '/foo'
      process.env.NODE_TLS_FOO = '1'
      const vars = checkTlsEnvironment()
      expect(vars).toEqual(
        expect.arrayContaining(['TRUSTSTORE_PATH', 'NODE_TLS_FOO'])
      )
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'TLS environment variables found: TRUSTSTORE_PATH, NODE_TLS_FOO'
        )
      )
    })
  })

  describe('setupUndiciProxy()', () => {
    it('creates ProxyAgent and sets global dispatcher', () => {
      const agent = {}
      ProxyAgent.mockImplementation((url, opts) => {
        expect(url).toBe('http://proxy')
        expect(opts.requestTls.rejectUnauthorized).toBe(true)
        return agent
      })
      const ret = setupUndiciProxy('http://proxy', true)
      expect(setGlobalDispatcher).toHaveBeenCalledWith(agent)
      expect(ret).toBe(agent)
      expect(infoSpy).toHaveBeenCalledWith(
        'Setting up ProxyAgent for undici...'
      )
      expect(infoSpy).toHaveBeenCalledWith(
        'undici dispatcher configured with proxy'
      )
    })

    it('rejectUnauthorized=false when secureContext disabled', () => {
      const agent = {}
      ProxyAgent.mockImplementation((url, opts) => {
        expect(url).toBe('u')
        expect(opts.requestTls.rejectUnauthorized).toBe(false)
        return agent
      })
      setupUndiciProxy('u', false)
    })
  })

  describe('setupGlobalAgent()', () => {
    it('bootstraps and sets globals', () => {
      delete process.env.NO_PROXY
      const ga = setupGlobalAgent('http://p')
      expect(bootstrap).toHaveBeenCalled()
      expect(global.GLOBAL_AGENT.HTTP_PROXY).toBe('http://p')
      expect(global.GLOBAL_AGENT.HTTPS_PROXY).toBe('http://p')
      expect(global.GLOBAL_AGENT.NO_PROXY).toMatch(/localhost,127\.0\.0\.1/)
      expect(infoSpy).toHaveBeenCalledWith('Setting up global-agent...')
      expect(infoSpy).toHaveBeenCalledWith('global-agent setup completed')
      expect(ga).toBe(global.GLOBAL_AGENT)
    })

    it('respects existing NO_PROXY env', () => {
      process.env.NO_PROXY = 'foo'
      setupGlobalAgent('u')
      expect(global.GLOBAL_AGENT.NO_PROXY).toBe('foo')
    })
  })

  describe('createTlsOptions()', () => {
    it('defaults rejectUnauthorized true', () => {
      expect(createTlsOptions(true, 'prod')).toEqual({
        rejectUnauthorized: true
      })
    })
    it('relaxes on test/staging and warns when disabled', () => {
      const opts = createTlsOptions(false, 'staging')
      expect(opts.rejectUnauthorized).toBe(false)
      expect(infoSpy).toHaveBeenCalledWith(
        'Using relaxed TLS options for staging environment'
      )
      expect(warnSpy).toHaveBeenCalledWith(
        'TLS certificate validation is DISABLED. This is not recommended for production.'
      )
    })
    it('keeps enabled in test if true', () => {
      const opts = createTlsOptions(true, 'test')
      expect(opts.rejectUnauthorized).toBe(true)
      expect(infoSpy).toHaveBeenCalledWith(
        'Using relaxed TLS options for test environment'
      )
    })
  })

  describe('setupHttpsProxyAgent()', () => {
    it('attaches global.PROXY_AGENT', () => {
      const fake = {}
      HttpsProxyAgent.mockImplementation((url, tls) => {
        expect(url).toBe('px')
        expect(tls).toEqual({ foo: 1 })
        return fake
      })
      const got = setupHttpsProxyAgent('px', { foo: 1 })
      expect(global.PROXY_AGENT).toBe(fake)
      expect(got).toBe(fake)
      expect(infoSpy).toHaveBeenCalledWith(
        'Setting up HttpsProxyAgent for node-fetch...'
      )
      expect(infoSpy).toHaveBeenCalledWith(
        'HttpsProxyAgent setup completed with custom TLS options'
      )
    })
  })

  describe('handleProxyError()', () => {
    it('logs all error details and TLS hint if appropriate', () => {
      const err = new Error('boom')
      err.name = 'MyError'
      err.code = 'ECODE'
      isTlsError.mockReturnValueOnce(true)

      const ret = handleProxyError(err)
      expect(ret).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('Error setting up proxy: boom')
      expect(errorSpy).toHaveBeenCalledWith('Error name: MyError')
      expect(errorSpy).toHaveBeenCalledWith('Error code: ECODE')
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'This appears to be a TLS/certificate validation issue.'
        )
      )
      expect(warnSpy).toHaveBeenCalledWith(
        'Continuing application startup despite proxy setup failure'
      )
    })

    it('skips TLS hint when not a TLS error', () => {
      const err = new Error('x')
      isTlsError.mockReturnValueOnce(false)
      handleProxyError(err)
      expect(errorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(
          'This appears to be a TLS/certificate validation issue.'
        )
      )
    })
  })

  describe('setupProxy()', () => {
    it('skips when no proxyUrl', () => {
      config.get.mockReturnValue('')
      const ret = setupProxy()
      expect(ret).toBeNull()
      expect(infoSpy).toHaveBeenCalledWith(
        'No HTTP_PROXY environment variable found, skipping proxy setup'
      )
    })

    it('runs full setup when proxyUrl present', () => {
      config.get
        .mockReturnValueOnce('http://px')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce('dev')

      const mockAgent = { type: 'proxyAgent' }
      const mockHttpsAgent = { type: 'httpsAgent' }

      ProxyAgent.mockReturnValue(mockAgent)
      HttpsProxyAgent.mockReturnValue(mockHttpsAgent)

      const result = setupProxy()

      expect(infoSpy).toHaveBeenCalledWith(
        'Setting up proxy with URL: http://px'
      )
      expect(infoSpy).toHaveBeenCalledWith('CDP Environment: dev')
      expect(infoSpy).toHaveBeenCalledWith('Secure context enabled: true')

      expect(result).toBe(mockHttpsAgent)
    })

    it('catches on error', () => {
      config.get.mockImplementation(() => {
        throw new Error('nope')
      })
      const ret = setupProxy()
      expect(ret).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('Error setting up proxy: nope')
    })
  })
})
