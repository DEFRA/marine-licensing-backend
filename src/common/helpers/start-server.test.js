import hapi from '@hapi/hapi'

const mockLoggerInfo = jest.fn()
const mockLoggerError = jest.fn()

const mockHapiLoggerInfo = jest.fn()
const mockHapiLoggerError = jest.fn()

jest.mock('hapi-pino', () => ({
  register: (server) => {
    server.decorate('server', 'logger', {
      info: mockHapiLoggerInfo,
      error: mockHapiLoggerError
    })
  },
  name: 'mock-hapi-pino'
}))
jest.mock('./logging/logger.js', () => ({
  createLogger: () => ({
    info: (...args) => mockLoggerInfo(...args),
    error: (...args) => mockLoggerError(...args)
  })
}))

describe('#startServer', () => {
  const ORIGINAL_ENV = process.env
  let createServerSpy
  let hapiServerSpy
  let startServer
  let serverInstance

  beforeAll(async () => {
    process.env = { ...ORIGINAL_ENV, PORT: '3098' }

    const serverMod = await import('../../server.js')
    const starterMod = await import('./start-server.js')

    createServerSpy = jest.spyOn(serverMod, 'createServer')
    hapiServerSpy = jest.spyOn(hapi, 'server')
    startServer = starterMod.startServer
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  describe('When server starts', () => {
    afterAll(async () => {
      if (serverInstance && typeof serverInstance.stop === 'function') {
        await serverInstance.stop({ timeout: 0 })
      }
    })

    test('emits the expected plugin startup messages', async () => {
      serverInstance = await startServer()

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()
      expect(mockHapiLoggerInfo).toHaveBeenNthCalledWith(
        1,
        'Custom secure context is disabled'
      )
      expect(mockHapiLoggerInfo).toHaveBeenNthCalledWith(
        2,
        'Setting up MongoDb'
      )
      expect(mockHapiLoggerInfo).toHaveBeenNthCalledWith(
        3,
        'MongoDb connected to marine-licensing-backend'
      )
    })
  })

  describe('When server start fails', () => {
    beforeAll(() => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))
    })

    test('logs the failure via createLogger', async () => {
      await startServer()

      expect(mockLoggerInfo).toHaveBeenCalledWith('Server failed to start :(')
      expect(mockLoggerError).toHaveBeenCalledWith(
        new Error('Server failed to start')
      )
    })
  })
})
