import hapi from '@hapi/hapi'

import { secureContext } from './index.js'
import { requestLogger } from '../logging/request-logger.js'
import { config } from '../../../config.js'

const mockAddCACert = jest.fn()
const mockTlsCreateSecureContext = jest
  .fn()
  .mockReturnValue({ context: { addCACert: mockAddCACert } })

jest.mock('hapi-pino', () => ({
  register: (server) => {
    server.decorate('server', 'logger', {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    })
  },
  name: 'mock-hapi-pino'
}))
jest.mock('node:tls', () => ({
  ...jest.requireActual('node:tls'),
  createSecureContext: (...args) => mockTlsCreateSecureContext(...args)
}))

describe('#secureContext', () => {
  let server

  describe('When secure context is disabled', () => {
    beforeEach(async () => {
      config.set('isSecureContextEnabled', false)
      server = hapi.server()
      await server.register([requestLogger, secureContext])
    })

    afterEach(async () => {
      config.set('isSecureContextEnabled', false)
      await server.stop({ timeout: 0 })
    })

    test('secureContext decorator should not be available', () => {
      expect(server.logger.info).toHaveBeenCalledWith(
        'Custom secure context is disabled'
      )
    })

    test('Logger should give us disabled message', () => {
      expect(server.secureContext).toBeUndefined()
    })
  })

  describe('When secure context is enabled', () => {
    const PROCESS_ENV = process.env

    beforeAll(() => {
      process.env = { ...PROCESS_ENV }
      process.env.TRUSTSTORE_ONE = 'mock-trust-store-cert-one'
    })

    beforeEach(async () => {
      config.set('isSecureContextEnabled', true)
      server = hapi.server()
      await server.register([requestLogger, secureContext])
    })

    afterEach(async () => {
      config.set('isSecureContextEnabled', false)
      await server.stop({ timeout: 0 })
    })

    afterAll(() => {
      process.env = PROCESS_ENV
    })

    test('Original tls.createSecureContext should have been called', () => {
      expect(mockTlsCreateSecureContext).toHaveBeenCalledWith({})
    })

    test('addCACert should have been called', () => {
      expect(mockAddCACert).toHaveBeenCalled()
    })

    test('secureContext decorator should be available', () => {
      expect(server.secureContext).toEqual({
        context: { addCACert: expect.any(Function) }
      })
    })
  })

  describe('When secure context is enabled without TRUSTSTORE_ certs', () => {
    const PROCESS_ENV = process.env

    beforeAll(() => {
      // Save the original environment and set up a clean one without TRUSTSTORE variables
      process.env = { ...PROCESS_ENV }

      // Remove any TRUSTSTORE_ environment variables
      Object.keys(process.env)
        .filter((key) => key.startsWith('TRUSTSTORE_'))
        .forEach((key) => {
          delete process.env[key]
        })
    })

    beforeEach(async () => {
      config.set('isSecureContextEnabled', true)
      server = hapi.server()
      await server.register([requestLogger, secureContext])
    })

    afterEach(async () => {
      config.set('isSecureContextEnabled', false)
      await server.stop({ timeout: 0 })
    })

    afterAll(() => {
      // Restore original environment
      process.env = PROCESS_ENV
    })

    test('Should log about not finding any TRUSTSTORE_ certs', () => {
      expect(server.logger.info).toHaveBeenCalledWith(
        'Could not find any TRUSTSTORE_ certificates'
      )
    })
  })

  describe('When there is an error adding certificate', () => {
    const PROCESS_ENV = process.env

    beforeAll(() => {
      process.env = { ...PROCESS_ENV }
      process.env.TRUSTSTORE_ERROR = 'mock-invalid-cert'

      mockAddCACert.mockImplementation(() => {
        throw new Error('Invalid certificate format')
      })
    })

    beforeEach(async () => {
      config.set('isSecureContextEnabled', true)
      server = hapi.server()
      await server.register([requestLogger, secureContext])
    })

    afterEach(async () => {
      config.set('isSecureContextEnabled', false)
      await server.stop({ timeout: 0 })
      mockAddCACert.mockReset()
    })

    afterAll(() => {
      process.env = PROCESS_ENV
    })

    test('Should log error when adding certificate fails', () => {
      expect(server.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add certificate')
      )
    })
  })
})
