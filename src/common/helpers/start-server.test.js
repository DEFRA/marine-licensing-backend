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
  let startServer
  let serverInstance

  beforeAll(async () => {
    process.env = { ...ORIGINAL_ENV, PORT: '3098' }

    jest.mock('../../server.js', () => ({
      createServer: jest.fn().mockImplementation(async () => {
        const server = {
          start: jest.fn().mockResolvedValue(),
          stop: jest.fn().mockResolvedValue(),
          logger: {
            info: mockHapiLoggerInfo,
            error: mockHapiLoggerError
          }
        }

        mockHapiLoggerInfo('Custom secure context is disabled')
        mockHapiLoggerInfo('Setting up MongoDb')
        mockHapiLoggerInfo('MongoDb connected to marine-licensing-backend')

        return server
      })
    }))

    const serverMod = await import('../../server.js')
    const starterMod = await import('./start-server.js')
    createServerSpy = serverMod.createServer
    startServer = starterMod.startServer
  })

  beforeEach(() => {
    mockHapiLoggerInfo.mockClear()
    mockHapiLoggerError.mockClear()
    mockLoggerInfo.mockClear()
    mockLoggerError.mockClear()
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
    jest.resetModules()
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

      expect(mockHapiLoggerInfo).toHaveBeenCalledWith(
        'Custom secure context is disabled'
      )
      expect(mockHapiLoggerInfo).toHaveBeenCalledWith('Setting up MongoDb')
      expect(mockHapiLoggerInfo).toHaveBeenCalledWith(
        'MongoDb connected to marine-licensing-backend'
      )
      expect(mockHapiLoggerInfo).toHaveBeenCalledWith(
        'Server started successfully'
      )
      expect(mockHapiLoggerInfo).toHaveBeenCalledWith(
        'Access your backend on http://localhost:3098'
      )
    })
  })

  describe('When server start fails', () => {
    beforeEach(() => {
      createServerSpy.mockRejectedValueOnce(new Error('Server failed to start'))
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
