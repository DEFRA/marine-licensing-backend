import { vi, describe, it, expect, beforeEach } from 'vitest'
import Hapi from '@hapi/hapi'

import { createServer } from './server.js'
import { config } from './config.js'
import { setupProxy } from './shared/common/helpers/proxy/setup-proxy.js'
import { failAction } from './shared/common/helpers/fail-action.js'
import { router } from './shared/plugins/router.js'
import { auth } from './shared/plugins/auth.js'
import { processDynamicsQueuePlugin } from './shared/plugins/dynamics.js'
import { processEmpQueuePlugin } from './shared/plugins/emp.js'
import { marinePlanPoliciesWorkerPlugin } from './shared/plugins/marine-plan-policies/worker.js'
import { marinePlanPoliciesDlqWorkerPlugin } from './shared/plugins/marine-plan-policies/dlq-worker.js'
import { masWorkerPlugin } from './shared/plugins/mas/mas-worker.js'
import { masDlqWorkerPlugin } from './shared/plugins/mas/mas-dlq-worker.js'
import { schedulerPlugin } from './shared/plugins/scheduler/index.js'
import { populateCoastalOperationsAreasPlugin } from './shared/plugins/geo-areas/populate-coastal-operations-areas.js'
import { populateMarinePlanAreasPlugin } from './shared/plugins/geo-areas/populate-marine-plan-areas.js'
import { simplifyMarinePlanAreasPlugin } from './shared/plugins/geo-areas/simplify-marine-plan-areas.js'
import { requestLogger } from './shared/common/helpers/logging/request-logger.js'
import { mongoDb } from './shared/common/helpers/mongodb.js'
import { pulse } from './shared/common/helpers/pulse.js'
import { requestTracing } from './shared/common/helpers/request-tracing.js'
import { secureContext } from '@defra/hapi-secure-context'
import hapiAuthJwt2 from 'hapi-auth-jwt2'

vi.mock('@hapi/hapi')
vi.mock('./config.js')
vi.mock('./shared/common/helpers/proxy/setup-proxy.js')
vi.mock('./shared/common/helpers/fail-action.js', () => ({
  failAction: vi.fn()
}))
vi.mock('./shared/plugins/router.js', () => ({
  router: { name: 'router', register: () => {} }
}))
vi.mock('./shared/plugins/auth.js', () => ({
  auth: { name: 'auth', register: () => {} }
}))
vi.mock('./shared/plugins/dynamics.js', () => ({
  processDynamicsQueuePlugin: { name: 'dynamics-queue', register: () => {} }
}))
vi.mock('./shared/plugins/emp.js', () => ({
  processEmpQueuePlugin: { name: 'emp-queue', register: () => {} }
}))
vi.mock('./shared/plugins/marine-plan-policies/worker.js', () => ({
  marinePlanPoliciesWorkerPlugin: {
    name: 'policies-worker',
    register: () => {}
  }
}))
vi.mock('./shared/plugins/marine-plan-policies/dlq-worker.js', () => ({
  marinePlanPoliciesDlqWorkerPlugin: {
    name: 'policies-dlq-worker',
    register: () => {}
  }
}))
vi.mock('./shared/plugins/mas/mas-worker.js', () => ({
  masWorkerPlugin: { name: 'mas-worker', register: () => {} }
}))
vi.mock('./shared/plugins/mas/mas-dlq-worker.js', () => ({
  masDlqWorkerPlugin: { name: 'mas-dlq-worker', register: () => {} }
}))
vi.mock('./shared/plugins/scheduler/index.js', () => ({
  schedulerPlugin: { name: 'scheduler', register: () => {} }
}))
vi.mock(
  './shared/plugins/geo-areas/populate-coastal-operations-areas.js',
  () => ({
    populateCoastalOperationsAreasPlugin: {
      name: 'coastal-areas',
      register: () => {}
    }
  })
)
vi.mock('./shared/plugins/geo-areas/populate-marine-plan-areas.js', () => ({
  populateMarinePlanAreasPlugin: {
    name: 'marine-plan-areas',
    register: () => {}
  }
}))
vi.mock('./shared/plugins/geo-areas/simplify-marine-plan-areas.js', () => ({
  simplifyMarinePlanAreasPlugin: {
    name: 'simplify-marine-plan-areas',
    register: () => {}
  }
}))
vi.mock('./shared/common/helpers/logging/request-logger.js', () => ({
  requestLogger: { name: 'request-logger', register: () => {} }
}))
vi.mock('./shared/common/helpers/mongodb.js', () => ({
  mongoDb: { name: 'mongodb', register: () => {} }
}))
vi.mock('./shared/common/helpers/pulse.js', () => ({
  pulse: { name: 'pulse', register: () => {} }
}))
vi.mock('./shared/common/helpers/request-tracing.js', () => ({
  requestTracing: { name: 'request-tracing', register: () => {} }
}))
vi.mock('@defra/hapi-secure-context', () => ({
  secureContext: { name: 'secure-context', register: () => {} }
}))
vi.mock('hapi-auth-jwt2', () => ({
  default: { name: 'hapi-auth-jwt2', register: () => {} }
}))

describe('createServer', () => {
  let mockServer
  const mongoOptions = {
    mongoUrl: 'mongodb://127.0.0.1:27017',
    databaseName: 'test'
  }

  beforeEach(() => {
    mockServer = { register: vi.fn().mockResolvedValue(undefined) }
    vi.mocked(Hapi.server).mockReturnValue(mockServer)

    config.get.mockImplementation((key) => {
      if (key === 'host') return '0.0.0.0'
      if (key === 'port') return 3001
      if (key === 'mongo') return mongoOptions
      return undefined
    })
  })

  const registered = () => vi.mocked(mockServer.register).mock.calls[0][0]

  it('should set up the proxy before creating the server', async () => {
    await createServer()

    expect(setupProxy).toHaveBeenCalledTimes(1)
    expect(vi.mocked(setupProxy).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(Hapi.server).mock.invocationCallOrder[0]
    )
  })

  it('should create the server on the configured host and port', async () => {
    await createServer()

    expect(Hapi.server).toHaveBeenCalledWith(
      expect.objectContaining({ host: '0.0.0.0', port: 3001 })
    )
  })

  it('should report all validation errors through failAction', async () => {
    await createServer()

    const [{ routes }] = vi.mocked(Hapi.server).mock.calls[0]
    expect(routes.validate.options.abortEarly).toBe(false)
    expect(routes.validate.failAction).toBe(failAction)
  })

  it('should apply the expected security response headers', async () => {
    await createServer()

    const [{ routes }] = vi.mocked(Hapi.server).mock.calls[0]
    expect(routes.security).toEqual({
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
      xss: 'enabled',
      noSniff: true,
      xframe: true
    })
  })

  it('should strip trailing slashes from request paths', async () => {
    await createServer()

    const [{ router: routerOptions }] = vi.mocked(Hapi.server).mock.calls[0]
    expect(routerOptions).toEqual({ stripTrailingSlash: true })
  })

  it('should register every plugin in a single call', async () => {
    await createServer()

    expect(mockServer.register).toHaveBeenCalledTimes(1)
  })

  const positionOf = (plugins, target) => {
    const index = plugins.indexOf(target)
    expect(index).toBeGreaterThanOrEqual(0)
    return index
  }

  it('should register requestTracing before requestLogger so traces reach the logs', async () => {
    await createServer()

    const plugins = registered()
    expect(positionOf(plugins, requestTracing)).toBeLessThan(
      positionOf(plugins, requestLogger)
    )
  })

  it('should register the auth strategy provider before the routes that use it', async () => {
    await createServer()

    const plugins = registered()
    expect(positionOf(plugins, hapiAuthJwt2)).toBeLessThan(
      positionOf(plugins, auth)
    )
    expect(positionOf(plugins, auth)).toBeLessThan(positionOf(plugins, router))
  })

  it('should register the queue processors and background workers', async () => {
    await createServer()

    const plugins = registered()
    for (const backgroundPlugin of [
      processDynamicsQueuePlugin,
      processEmpQueuePlugin,
      marinePlanPoliciesWorkerPlugin,
      marinePlanPoliciesDlqWorkerPlugin,
      masWorkerPlugin,
      masDlqWorkerPlugin,
      schedulerPlugin
    ]) {
      expect(plugins).toContain(backgroundPlugin)
    }
  })

  it('should register the plugins that harden and observe the server', async () => {
    await createServer()

    const plugins = registered()
    for (const infrastructurePlugin of [
      requestTracing,
      requestLogger,
      secureContext,
      pulse
    ]) {
      expect(plugins).toContain(infrastructurePlugin)
    }
  })

  it('should register mongoDb with the mongo config before the plugins that need a db', async () => {
    await createServer()

    const plugins = registered()
    const mongoEntry = plugins.find((entry) => entry?.plugin === mongoDb)
    expect(mongoEntry.options).toBe(mongoOptions)

    for (const geoAreaPlugin of [
      populateCoastalOperationsAreasPlugin,
      populateMarinePlanAreasPlugin,
      simplifyMarinePlanAreasPlugin
    ]) {
      expect(positionOf(plugins, mongoEntry)).toBeLessThan(
        positionOf(plugins, geoAreaPlugin)
      )
    }
  })

  it('should build the simplified marine plan areas after the source collection is populated', async () => {
    await createServer()

    const plugins = registered()
    expect(positionOf(plugins, populateMarinePlanAreasPlugin)).toBeLessThan(
      positionOf(plugins, simplifyMarinePlanAreasPlugin)
    )
  })

  it('should return the created server', async () => {
    await expect(createServer()).resolves.toBe(mockServer)
  })

  it('should propagate a plugin registration failure', async () => {
    mockServer.register.mockRejectedValue(new Error('registration failed'))

    await expect(createServer()).rejects.toThrow('registration failed')
  })
})
