import fetch from 'node-fetch'
import Jwt from '@hapi/jwt'
import Bell from '@hapi/bell'
import { config } from '../../../config.js'
import { defraId } from './defra-id.js'

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('@hapi/jwt', () => ({
  __esModule: true,
  default: { token: { decode: jest.fn() } }
}))

describe('defraId plugin', () => {
  let server
  let fakeOidc

  beforeEach(() => {
    jest.resetAllMocks()

    jest.spyOn(config, 'get').mockImplementation(
      (key) =>
        ({
          defraIdOidcConfigurationUrl:
            'http://stub/.well-known/openid-configuration',
          defraIdServiceId: 'svc-id',
          defraIdClientId: 'client-id',
          defraIdClientSecret: 'test_value',
          host: 'api.local',
          port: 4000,
          defraIdCookiePassword: 'cookie-pass'
        })[key]
    )

    fakeOidc = {
      authorization_endpoint: 'https://auth/',
      token_endpoint: 'https://token/',
      end_session_endpoint: 'https://logout/'
    }
    fetch.mockResolvedValue({ json: async () => fakeOidc })

    Jwt.token.decode = jest.fn().mockReturnValue({
      decoded: {
        payload: {
          sub: 'user-123',
          firstName: 'Dimitri',
          lastName: 'Alpha',
          email: 'dimitri@alpha.com',
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

  afterEach(() => jest.restoreAllMocks())

  it('fetches discovery and registers Bell', async () => {
    await defraId.plugin.register(server)
    expect(fetch).toHaveBeenCalledWith(
      'http://stub/.well-known/openid-configuration'
    )
    expect(server.register).toHaveBeenCalledWith(Bell)
  })

  it('defines defra-id strategy options', async () => {
    await defraId.plugin.register(server)
    const [name, scheme, opts] = server.auth.strategy.mock.calls[0]
    expect(name).toBe('defra-id')
    expect(scheme).toBe('bell')
    expect(opts.clientId).toBe('client-id')
    expect(opts.clientSecret).toBe('test_value')
    expect(opts.cookie).toBe('bell-defra-id')
    expect(opts.password).toBe('cookie-pass')
    expect(opts.isSecure).toBe(false)
    expect(opts.providerParams).toEqual({ serviceId: 'svc-id' })
  })

  it('location() returns correct callback URL', async () => {
    await defraId.plugin.register(server)
    const opts = server.auth.strategy.mock.calls[0][2]
    expect(opts.location()).toBe('http://api.local:4000/auth/callback')
  })

  it('uses OIDC doc values', async () => {
    await defraId.plugin.register(server)
    const provider = server.auth.strategy.mock.calls[0][2].provider
    expect(provider.auth).toBe(fakeOidc.authorization_endpoint)
    expect(provider.token).toBe(fakeOidc.token_endpoint)
    expect(provider.scope).toEqual(['openid', 'offline_access'])
  })

  it('profile() maps payload for Dimitri', async () => {
    Jwt.token.decode.mockReturnValue({
      decoded: {
        payload: {
          sub: 'my-user',
          firstName: 'Dimitri',
          lastName: 'Alpha',
          email: 'dimitri@alpha.com',
          roles: ['r1', 'r2'],
          relationships: ['org-x']
        }
      }
    })
    await defraId.plugin.register(server)
    const provider = server.auth.strategy.mock.calls[0][2].provider
    const credentials = { token: 'JWT-TOKEN' }
    const params = { id_token: 'ID-TOKEN' }
    provider.profile(credentials, params)
    expect(Jwt.token.decode).toHaveBeenCalledWith('JWT-TOKEN')
    expect(credentials.profile).toEqual({
      id: 'my-user',
      firstName: 'Dimitri',
      lastName: 'Alpha',
      email: 'dimitri@alpha.com',
      roles: ['r1', 'r2'],
      relationships: ['org-x'],
      rawIdToken: 'ID-TOKEN',
      logoutUrl: fakeOidc.end_session_endpoint
    })
  })

  it('sets default strategy', async () => {
    await defraId.plugin.register(server)
    expect(server.auth.default).toHaveBeenCalledWith('defra-id')
  })

  it('throws on discovery fetch failure', async () => {
    fetch.mockRejectedValue(new Error('fetch-bang'))
    await expect(defraId.plugin.register(server)).rejects.toThrow('fetch-bang')
  })

  it('throws on Bell registration failure', async () => {
    server.register.mockRejectedValue(new Error('bell-bang'))
    await expect(defraId.plugin.register(server)).rejects.toThrow('bell-bang')
  })
})
