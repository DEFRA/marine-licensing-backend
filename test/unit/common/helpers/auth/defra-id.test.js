/* eslint-disable no-unused-expressions */
import sinon from 'sinon'
import { expect } from 'chai'

import fetch from 'node-fetch'
import Jwt from '@hapi/jwt'

import { config } from '../../../../src/config.js'
import { defraId } from '../../../../src/common/helpers/auth/defra-id.js'

describe('defra-id plugin', () => {
  let server, fakeOidc

  beforeEach(() => {
    sinon
      .stub(config, 'get')
      .withArgs('defraIdOidcConfigurationUrl')
      .returns('http://stub/.well-known/openid-configuration')
      .withArgs('defraIdServiceId')
      .returns('svc-id')
      .withArgs('defraIdClientId')
      .returns('client-id')
      .withArgs('defraIdClientSecret')
      .returns('secret-val')
      .withArgs('host')
      .returns('api.local')
      .withArgs('port')
      .returns(4000)
      .withArgs('session.cookie.password')
      .returns('cookie-pass')

    // Stub fetch() → fake OIDC discovery doc
    fakeOidc = {
      authorization_endpoint: 'https://auth/',
      token_endpoint: 'https://token/',
      end_session_endpoint: 'https://logout/'
    }
    sinon.stub(fetch, 'default').resolves({
      json: async () => fakeOidc
    })

    // Stub JWT decode so profile() won’t crash
    sinon.stub(Jwt.token, 'decode').returns({
      decoded: {
        payload: {
          sub: 'user-123',
          firstName: 'Dimitri',
          lastName: 'Alpha',
          email: 'dimitri@alpha.com',
          roles: ['r1', 'r2'],
          relationships: ['org-x'],
          uniqueReference: 'u-ref'
        }
      }
    })

    // Fake Hapi server
    server = {
      register: sinon.stub().resolves(),
      auth: {
        strategy: sinon.stub(),
        default: sinon.stub()
      }
    }
  })

  afterEach(() => sinon.restore())

  it('calls fetch() with the configured discovery URL', async () => {
    await defraId.plugin.register(server)
    expect(fetch.default).to.have.been.calledWith(
      'http://stub/.well-known/openid-configuration'
    )
  })

  it('registers the Bell plugin exactly once', async () => {
    await defraId.plugin.register(server)
    expect(server.register.callCount).to.equal(1)
  })

  it('defines a "defra-id" auth.strategy with correct parameters', async () => {
    await defraId.plugin.register(server)

    const [name, scheme, opts] = server.auth.strategy.firstCall.args

    expect(name).to.equal('defra-id')
    expect(scheme).to.equal('bell')

    // Checks client credentials
    expect(opts.clientId).to.equal('client-id')
    expect(opts.clientSecret).to.equal('secret-val')

    // Checks cookie & security
    expect(opts.cookie).to.equal('bell-defra-id')
    expect(opts.password).to.equal('cookie-pass')
    expect(opts.isSecure).to.be.false

    // Checks providerParams
    expect(opts.providerParams).to.deep.equal({ serviceId: 'svc-id' })
  })

  it('location() returns the correct callback URL', async () => {
    await defraId.plugin.register(server)
    const opts = server.auth.strategy.firstCall.args[2]

    const url = opts.location()
    expect(url).to.equal('http://api.local:4000/auth/callback')
  })

  it('provider.auth & provider.token & provider.scope come from OIDC doc', async () => {
    await defraId.plugin.register(server)
    const provider = server.auth.strategy.firstCall.args[2].provider

    expect(provider.auth).to.equal(fakeOidc.authorization_endpoint)
    expect(provider.token).to.equal(fakeOidc.token_endpoint)
    expect(provider.scope).to.deep.equal(['openid', 'offline_access'])
  })

  it('provider.profile() maps token → credentials.profile correctly', async () => {
    await defraId.plugin.register(server)
    const provider = server.auth.strategy.firstCall.args[2].provider

    const credentials = { token: 'fake-jwt' }
    const params = { id_token: 'ID_TOK' }

    provider.profile(credentials, params)

    expect(credentials.profile).to.include({
      id: 'user-123',
      firstName: 'Dimitri',
      lastName: 'Alpha',
      email: 'dimitri@alpha.com',
      rawIdToken: 'ID_TOK',
      logoutUrl: fakeOidc.end_session_endpoint
    })
    expect(credentials.profile.roles).to.deep.equal(['r1', 'r2'])
    expect(credentials.profile.relationships).to.deep.equal(['org-x'])
  })
  it('sets "defra-id" as the default auth strategy', async () => {
    await defraId.plugin.register(server)
    expect(server.auth.default).to.have.been.calledWith('defra-id')
  })

  it('location() returns the correct callback URL using host+port', async () => {
    await defraId.plugin.register(server)

    const opts = server.auth.strategy.mock.calls[0][2]
    expect(opts.location()).toBe(
      `http://${config.get('host')}:${config.get('port')}/auth/callback`
    )
  })

  it('provider.profile() calls Jwt.token.decode and maps the payload', async () => {
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
      logoutUrl: expect.any(String)
    })
  })
})
