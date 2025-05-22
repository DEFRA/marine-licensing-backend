import Bell from '@hapi/bell'
import fetch from 'node-fetch'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'
import { defraId } from './defra-id.js'

jest.mock('node-fetch')
jest.mock('@hapi/jwt', () => ({
  __esModule: true,
  default: {
    token: {
      decode: jest.fn()
    }
  }
}))

describe('defraId plugin', () => {
  let server
  let fakeOidc
  let originalNodeEnv

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    jest.clearAllMocks()
    jest.spyOn(config, 'get').mockImplementation(
      (key) =>
        ({
          defraIdOidcConfigurationUrl:
            'http://stub/.well-known/openid-configuration',
          defraIdServiceId: 'svc-id',
          defraIdClientId: 'client-id',
          defraIdClientSecret: 'secret-val',
          appBaseUrl: 'http://api.local:4000',
          defraIdCookiePassword: 'cookie-pass',
          redirectUri: 'http://api.local:4000/auth/callback'
        })[key]
    )

    fakeOidc = {
      authorization_endpoint: 'https://auth/',
      token_endpoint: 'https://token/',
      end_session_endpoint: 'https://logout/'
    }
    fetch.mockResolvedValue({ json: async () => fakeOidc })

    Jwt.token.decode.mockReturnValue({
      decoded: {
        payload: {
          sub: 'my-user',
          firstName: 'Dimitri',
          lastName: 'Alpha',
          email: 'dimi@alpha.com',
          roles: ['r1', 'r2'],
          relationships: ['org-x']
        }
      }
    })

    server = {
      register: jest.fn().mockResolvedValue(),
      auth: {
        strategy: jest.fn(),
        default: jest.fn()
      }
    }
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('fetches discovery and registers Bell', async () => {
    await defraId.plugin.register(server)
    expect(fetch).toHaveBeenCalledWith(
      'http://stub/.well-known/openid-configuration'
    )
    expect(server.register).toHaveBeenCalledWith(Bell)
  })

  it('defines the defra-id strategy correctly', async () => {
    await defraId.plugin.register(server)
    const [name, scheme, opts] = server.auth.strategy.mock.calls[0]
    expect(name).toBe('defra-id')
    expect(scheme).toBe('bell')
    expect(opts.clientId).toBe('client-id')
    expect(opts.clientSecret).toBe('secret-val')
    expect(opts.cookie).toBe('bell-defra-id')
    expect(opts.password).toBe('cookie-pass')
    expect(opts.isSecure).toBe(false)
    expect(opts.providerParams).toEqual({ serviceId: 'svc-id' })
  })

  it('builds the correct callback URL in location()', async () => {
    await defraId.plugin.register(server)
    const opts = server.auth.strategy.mock.calls[0][2]
    const fakeReq = { info: {}, yar: { flash: jest.fn() } }
    expect(opts.location(fakeReq)).toBe('http://api.local:4000/auth/callback')
  })

  it('uses the OIDC discovery endpoints', async () => {
    await defraId.plugin.register(server)
    const provider = server.auth.strategy.mock.calls[0][2].provider
    expect(provider.auth).toBe(fakeOidc.authorization_endpoint)
    expect(provider.token).toBe(fakeOidc.token_endpoint)
    expect(provider.scope).toEqual(['openid', 'offline_access'])
  })

  it('maps the JWT payload into credentials.profile', async () => {
    await defraId.plugin.register(server)
    const provider = server.auth.strategy.mock.calls[0][2].provider
    const creds = { token: 'ABC' }
    const params = { id_token: 'ID-TOKEN' }
    provider.profile(creds, params)
    expect(Jwt.token.decode).toHaveBeenCalledWith('ABC')
    expect(creds.profile).toEqual({
      id: 'my-user',
      firstName: 'Dimitri',
      lastName: 'Alpha',
      email: 'dimi@alpha.com',
      roles: ['r1', 'r2'],
      relationships: ['org-x'],
      rawIdToken: 'ID-TOKEN',
      logoutUrl: fakeOidc.end_session_endpoint
    })
  })

  it('sets the default auth strategy to defra-id', async () => {
    await defraId.plugin.register(server)
    expect(server.auth.default).toHaveBeenCalledWith('defra-id')
  })

  it('propagates fetch errors', async () => {
    fetch.mockRejectedValue(new Error('fetch-bang'))
    await expect(defraId.plugin.register(server)).rejects.toThrow('fetch-bang')
  })

  it('propagates Bell registration errors', async () => {
    server.register.mockRejectedValue(new Error('bell-bang'))
    await expect(defraId.plugin.register(server)).rejects.toThrow('bell-bang')
  })

  it('sets dummy auth strategy in test environment', async () => {
    process.env.NODE_ENV = 'test'
    await defraId.plugin.register(server)
    expect(server.auth.default).toHaveBeenCalledWith('dummy')
    expect(server.register).not.toHaveBeenCalled()
  })
})
