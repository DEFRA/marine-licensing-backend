import { jest } from '@jest/globals'

// Mock dependencies
jest.mock('@defra/hapi-tracing', () => ({
  tracing: {
    plugin: 'mocked-tracing-plugin'
  }
}))

jest.mock('../../config.js', () => ({
  config: {
    get: jest.fn().mockReturnValue('x-trace-id')
  }
}))

describe('requestTracing plugin', () => {
  let requestTracing

  beforeAll(() => {
    // Dynamically import after mocks are set up
    requestTracing = require('./request-tracing.js').requestTracing
  })

  test('should export requestTracing with the correct structure', () => {
    expect(requestTracing).toHaveProperty('plugin')
    expect(requestTracing).toHaveProperty('options')
  })

  test('should use tracing.plugin as the plugin', () => {
    expect(requestTracing.plugin).toBe('mocked-tracing-plugin')
  })

  test('should configure options with tracingHeader from config', () => {
    expect(requestTracing.options.tracingHeader).toBe('x-trace-id')
  })
})
