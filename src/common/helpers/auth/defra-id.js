import Bell from '@hapi/bell'
import fetch from 'node-fetch'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'

export const defraId = {
  plugin: {
    name: 'defra-id',
    register: async (server) => {
      const oidcConfigurationUrl = config.get('defraIdOidcConfigurationUrl')
      const authCallbackUrl = config.get('appBaseUrl') + '/auth/callback'

      await server.register(Bell)

      const oidcConf = await fetch(oidcConfigurationUrl).then((res) =>
        res.json()
      )

      server.auth.strategy('defra-id', 'bell', {
        location: (request) => {
          if (request.info.referrer) {
            request.yar.flash('referrer', request.info.referrer)
          }
          return authCallbackUrl
        },
        provider: {
          name: 'defra-id',
          protocol: 'oauth2',
          useParamsAuth: true,
          auth: oidcConf.authorization_endpoint,
          token: oidcConf.token_endpoint,
          scope: ['openid', 'offline_access'],
          profile: (credentials, params) => {
            const {
              decoded: { payload }
            } = Jwt.token.decode(credentials.token)
            credentials.profile = {
              id: payload.sub,
              firstName: payload.firstName,
              lastName: payload.lastName,
              email: payload.email,
              roles: payload.roles,
              relationships: payload.relationships,
              rawIdToken: params.id_token,
              logoutUrl: oidcConf.end_session_endpoint
            }
          }
        },
        clientId: config.get('defraIdClientId'),
        clientSecret: config.get('defraIdClientSecret'),
        cookie: 'bell-defra-id',
        password: config.get('defraIdCookiePassword'),
        isSecure: false,
        providerParams: {
          serviceId: config.get('defraIdServiceId')
        }
      })

      server.auth.default('defra-id')
    }
  }
}
