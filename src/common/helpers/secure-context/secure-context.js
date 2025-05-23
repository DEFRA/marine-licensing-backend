import tls from 'node:tls'
import { config } from '../../../config.js'
import { createLogger } from '../logging/logger.js'
import { getTrustStoreCerts } from './get-trust-store-certs.js'

const logger = createLogger()

export const secureContext = {
  plugin: {
    name: 'secure-context',
    register(server) {
      logger.info(
        `Secure Context Plugin - isSecureContextEnabled: ${config.get('isSecureContextEnabled')}`
      )
      logger.info(
        `Environment: ${process.env.NODE_ENV}, CDP Environment: ${config.get('cdpEnvironment')}`
      )

      if (config.get('isSecureContextEnabled')) {
        logger.info(
          'Secure context is enabled - setting up TLS certificate trust'
        )

        const originalTlsCreateSecureContext = tls.createSecureContext

        tls.createSecureContext = function (options = {}) {
          const trustStoreCerts = getTrustStoreCerts(process.env)

          if (!trustStoreCerts.length) {
            server.logger.info('Could not find any TRUSTSTORE_ certificates')
            server.logger.warn(
              'No custom certificates were loaded. TLS connections may fail if the CA is not in the system trust store.'
            )
          } else {
            server.logger.info(
              `Found ${trustStoreCerts.length} TRUSTSTORE_ certificates to add to trust store`
            )
          }

          const trustStoreEnvVars = Object.keys(process.env).filter((key) =>
            key.startsWith('TRUSTSTORE_')
          )
          server.logger.info(
            `TRUSTSTORE environment variables found: ${trustStoreEnvVars.join(', ') || 'none'}`
          )

          const tlsSecureContext = originalTlsCreateSecureContext(options)

          trustStoreCerts.forEach((cert, index) => {
            try {
              server.logger.info(
                `Adding certificate #${index + 1} to TLS context`
              )
              tlsSecureContext.context.addCACert(cert)
            } catch (error) {
              server.logger.error(
                `Failed to add certificate #${index + 1}: ${error.message}`
              )
            }
          })

          return tlsSecureContext
        }

        try {
          const secureContextInstance = tls.createSecureContext()
          server.decorate('server', 'secureContext', secureContextInstance)
          server.logger.info('Server decorated with secureContext successfully')
        } catch (error) {
          server.logger.error(
            `Failed to create secure context: ${error.message}`
          )
          server.logger.error(`Error stack: ${error.stack}`)
        }
      } else {
        server.logger.info('Custom secure context is disabled')
      }
    }
  }
}
