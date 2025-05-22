import { jest } from '@jest/globals'

jest.mock('@hapi/hapi', () => ({
  server: jest.fn(() => ({
    register: jest.fn().mockResolvedValue()
  }))
}))

jest.mock('./config.js', () => ({
  config: {
    get: jest.fn((key) => {
      const configValues = {
        host: '0.0.0.0',
        port: 3001,
        isTest: process.env.NODE_ENV === 'test',
        log: {
          isEnabled: true,
          level: 'info',
          format: 'pino-pretty',
          redact: []
        },
        'tracing.header': 'x-trace-id',
        serviceName: 'marine-licensing-backend',
        serviceVersion: '1.0.0'
      }
      return configValues[key]
    })
  }
}))

jest.mock('./common/helpers/auth/defra-id.js', () => ({
  defraId: { plugin: { register: jest.fn() } }
}))

jest.mock('./plugins/router.js', () => ({
  router: { plugin: { register: jest.fn() } }
}))

jest.mock('./common/helpers/logging/request-logger.js', () => ({
  requestLogger: { plugin: { register: jest.fn() } }
}))

jest.mock('./common/helpers/mongodb.js', () => ({
  mongoDb: { plugin: { register: jest.fn() } }
}))

jest.mock('./common/helpers/fail-action.js', () => ({
  failAction: jest.fn()
}))

jest.mock('./common/helpers/secure-context/index.js', () => ({
  secureContext: { plugin: { register: jest.fn() } }
}))

jest.mock('./common/helpers/pulse.js', () => ({
  pulse: { plugin: { register: jest.fn() } }
}))

jest.mock('@defra/hapi-tracing', () => ({
  tracing: {
    plugin: { register: jest.fn() }
  },
  getTraceId: jest.fn().mockReturnValue('mock-trace-id')
}))

jest.mock('./common/helpers/request-tracing.js', () => ({
  requestTracing: { plugin: { register: jest.fn() } }
}))

jest.mock('./common/helpers/proxy/setup-proxy.js', () => ({
  setupProxy: jest.fn()
}))

describe('server', () => {
  let Hapi,
    defraId,
    router,
    requestLogger,
    mongoDb,
    failAction,
    secureContext,
    pulse,
    requestTracing,
    setupProxy,
    createServer

  let originalNodeEnv

  beforeAll(async () => {
    Hapi = await import('@hapi/hapi')
    const defraIdModule = await import('./common/helpers/auth/defra-id.js')
    const routerModule = await import('./plugins/router.js')
    const requestLoggerModule = await import(
      './common/helpers/logging/request-logger.js'
    )
    const mongoDbModule = await import('./common/helpers/mongodb.js')
    const failActionModule = await import('./common/helpers/fail-action.js')
    const secureContextModule = await import(
      './common/helpers/secure-context/index.js'
    )
    const pulseModule = await import('./common/helpers/pulse.js')
    const requestTracingModule = await import(
      './common/helpers/request-tracing.js'
    )
    const setupProxyModule = await import(
      './common/helpers/proxy/setup-proxy.js'
    )
    const serverModule = await import('./server.js')

    defraId = defraIdModule.defraId
    router = routerModule.router
    requestLogger = requestLoggerModule.requestLogger
    mongoDb = mongoDbModule.mongoDb
    failAction = failActionModule.failAction
    secureContext = secureContextModule.secureContext
    pulse = pulseModule.pulse
    requestTracing = requestTracingModule.requestTracing
    setupProxy = setupProxyModule.setupProxy
    createServer = serverModule.createServer
  })

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  test('should create a server with correct configuration', async () => {
    await createServer()

    expect(Hapi.server).toHaveBeenCalledWith({
      host: '0.0.0.0',
      port: 3001,
      routes: {
        validate: {
          options: {
            abortEarly: false
          },
          failAction
        },
        security: {
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: false
          },
          xss: 'enabled',
          noSniff: true,
          xframe: true
        }
      },
      router: {
        stripTrailingSlash: true
      }
    })
  })

  test('should call setupProxy', async () => {
    await createServer()
    expect(setupProxy).toHaveBeenCalled()
  })

  test('should register all plugins in non-test environment', async () => {
    process.env.NODE_ENV = 'development'

    const server = await createServer()

    expect(server.register).toHaveBeenCalledWith([
      requestLogger,
      requestTracing,
      secureContext,
      pulse,
      mongoDb,
      defraId,
      router
    ])
  })

  test('should exclude defraId plugin in test environment', async () => {
    process.env.NODE_ENV = 'test'

    const server = await createServer()

    expect(server.register).toHaveBeenCalledWith([
      requestLogger,
      requestTracing,
      secureContext,
      pulse,
      mongoDb,
      router
    ])
  })

  test('should return a server instance', async () => {
    const result = await createServer()
    expect(result).toBeTruthy()
    expect(typeof result.register).toBe('function')
  })
})
