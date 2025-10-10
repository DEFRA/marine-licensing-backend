import { vi } from 'vitest'
import { loggerOptions } from './logger-options.js'
import { getTraceId } from '@defra/hapi-tracing'

vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: vi.fn()
}))

vi.mock('@elastic/ecs-pino-format', () => ({
  ecsFormat: vi.fn().mockImplementation(({ serviceVersion, serviceName }) => ({
    formatCalled: true,
    serviceVersion,
    serviceName
  }))
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'log') {
        return {
          isEnabled: true,
          redact: ['req.headers.authorization'],
          level: 'info',
          format: 'ecs'
        }
      }
      if (key === 'serviceName') return 'TestService'
      if (key === 'serviceVersion') return '1.0.0'
    })
  }
}))

describe('loggerOptions', () => {
  it('should have the correct properties based on config and ecsFormat', () => {
    expect(loggerOptions.enabled).toBe(true)
    expect(loggerOptions.ignorePaths).toEqual(['/health'])
    expect(loggerOptions.redact).toEqual({
      paths: ['req.headers.authorization'],
      remove: true
    })
    expect(loggerOptions.level).toEqual('info')
    expect(loggerOptions.nesting).toBe(true)
    expect(loggerOptions.formatCalled).toBe(true)
    expect(loggerOptions.serviceVersion).toEqual('1.0.0')
    expect(loggerOptions.serviceName).toEqual('TestService')
  })

  it('mixin returns an object with trace when getTraceId returns a value', () => {
    getTraceId.mockReturnValue('1234')
    const result = loggerOptions.mixin()
    expect(result).toEqual({ trace: { id: '1234' } })
  })

  it('mixin returns an empty object when getTraceId returns undefined', () => {
    getTraceId.mockReturnValue(undefined)
    const result = loggerOptions.mixin()
    expect(result).toEqual({})
  })
})
