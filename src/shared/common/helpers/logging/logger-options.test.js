import { vi, describe, it, expect } from 'vitest'
import { loggerOptions } from './logger-options.js'
import { getTraceId } from '@defra/hapi-tracing'
import { structureErrorForECS } from './logger.js'
import { ErrorWithData } from '../error-with-data.js'

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

vi.mock('../../../../config.js', () => ({
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

describe('structureErrorForECS', () => {
  it('should return empty object for null/undefined error', () => {
    expect(structureErrorForECS(null)).toEqual({})
    expect(structureErrorForECS(undefined)).toEqual({})
  })

  it('should structure a basic Error object', () => {
    const error = new Error('Test error message')
    error.stack = 'Error: Test error message\n    at test.js:1:1'

    const result = structureErrorForECS(error)

    expect(result.error).toEqual({
      message: 'Test error message',
      stack_trace: 'Error: Test error message\n    at test.js:1:1',
      type: 'Error',
      code: undefined
    })
    expect(result.http).toBeUndefined()
  })

  it('should extract HTTP status code from various error object locations', () => {
    // Test error.statusCode (direct property)
    const error1 = new Error('HTTP error')
    error1.statusCode = 404
    const result1 = structureErrorForECS(error1)
    expect(result1.http).toEqual({ response: { status_code: 404 } })

    // Test error.response.statusCode
    const error2 = new Error('API error')
    error2.response = { statusCode: 500 }
    const result2 = structureErrorForECS(error2)
    expect(result2.http).toEqual({ response: { status_code: 500 } })

    // Test error.res.statusCode
    const error3 = new Error('API error')
    error3.res = { statusCode: 400 }
    const result3 = structureErrorForECS(error3)
    expect(result3.http).toEqual({ response: { status_code: 400 } })

    // Test error.status
    const error4 = new Error('API error')
    error4.status = 403
    const result4 = structureErrorForECS(error4)
    expect(result4.http).toEqual({ response: { status_code: 403 } })

    // Test error.output.statusCode (Boom errors)
    const error5 = new Error('Boom error')
    error5.output = { statusCode: 401 }
    const result5 = structureErrorForECS(error5)
    expect(result5.http).toEqual({ response: { status_code: 401 } })
  })

  it('should include error code when available, with statusCode as fallback', () => {
    // Test explicit error.code
    const error1 = new Error('Error with code')
    error1.code = 'CUSTOM_ERROR_CODE'
    const result1 = structureErrorForECS(error1)
    expect(result1.error.code).toBe('CUSTOM_ERROR_CODE')

    // Test statusCode as code fallback
    const error2 = new Error('Error')
    error2.statusCode = 503
    const result2 = structureErrorForECS(error2)
    expect(result2.error.code).toBe(503)
  })

  it('should include response data in error message from various sources', () => {
    // Test ErrorWithData with error.data
    const errorData1 = {
      errors: [{ field: 'email', message: 'Invalid email' }]
    }
    const error1 = new ErrorWithData('Error sending email', errorData1)
    error1.statusCode = 400
    const result1 = structureErrorForECS(error1)
    expect(result1.error.message).toContain('Error sending email')
    expect(result1.error.message).toContain('response:')
    expect(result1.error.message).toContain('Invalid email')
    expect(result1.http).toEqual({ response: { status_code: 400 } })

    // Test error.response.data
    const error2 = new Error('API request failed')
    error2.response = {
      statusCode: 400,
      data: { error: 'Bad Request', details: 'Missing required field' }
    }
    const result2 = structureErrorForECS(error2)
    expect(result2.error.message).toContain('API request failed')
    expect(result2.error.message).toContain('response:')
    expect(result2.error.message).toContain('Bad Request')

    // Test preference: error.data over error.response.data
    const error3 = new Error('Error')
    error3.data = { errors: ['Primary error'] }
    error3.response = { data: { errors: ['Secondary error'] } }
    const result3 = structureErrorForECS(error3)
    expect(result3.error.message).toContain('Primary error')
    expect(result3.error.message).not.toContain('Secondary error')

    // Test string payload in response.data
    const error4 = new Error('Error')
    error4.response = { data: 'Simple error message' }
    const result4 = structureErrorForECS(error4)
    expect(result4.error.message).toContain('Error')
    expect(result4.error.message).toContain('response: Simple error message')
  })

  it('should handle circular reference in payload gracefully', () => {
    const error = new Error('Error')
    const circular = { data: 'test' }
    circular.self = circular
    error.data = circular

    const result = structureErrorForECS(error)

    expect(result.error.message).toContain('Error')
  })

  it('should handle non-Error objects with and without message property', () => {
    // Test object with message
    const error1 = { message: 'String error', code: 'ERR_CODE' }
    const result1 = structureErrorForECS(error1)
    expect(result1.error.message).toBe('String error')
    expect(result1.error.code).toBe('ERR_CODE')

    // Test object without message
    const error2 = { code: 'ERR_CODE' }
    const result2 = structureErrorForECS(error2)
    expect(result2.error.message).toBe('[object Object]')
    expect(result2.error.code).toBe('ERR_CODE')
  })

  it('should remove undefined fields from error details', () => {
    const error = {
      message: 'Test',
      name: 'Error'
    }

    const result = structureErrorForECS(error)

    expect(result.error).not.toHaveProperty('stack_trace')
    expect(result.error).not.toHaveProperty('code')
  })

  it('should handle custom error types', () => {
    class CustomError extends Error {
      constructor(message) {
        super(message)
        this.name = 'CustomError'
      }
    }

    const error = new CustomError('Custom error message')

    const result = structureErrorForECS(error)

    expect(result.error.type).toBe('CustomError')
    expect(result.error.message).toBe('Custom error message')
  })
})
