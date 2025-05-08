import Bell from '@hapi/bell'
import fetch from 'node-fetch'
import Jwt from '@hapi/jwt'
import { config } from '../../../config.js'

export const defraId = {
  plugin: {
    name: 'defra-id',
    register: async (server) => {
      const oidcConf = await fetch(
        config.get('defraIdOidcConfigurationUrl')
      ).then((res) => res.json())

      await server.register(Bell)

      server.auth.strategy('defra-id', 'bell', {
        location: () =>
          `http://${config.get('host')}:${config.get('port')}/auth/callback`,
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
