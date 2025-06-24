import { jest } from '@jest/globals'

// Mock dependencies
jest.mock('hapi-pulse', () => 'mocked-hapi-pulse')
jest.mock('./logging/logger.js', () => ({
  createLogger: jest.fn().mockReturnValue('mocked-logger')
}))

describe('pulse plugin', () => {
  let hapiPulse, pulse

  beforeAll(() => {
    // Dynamically import after mocks are set up
    hapiPulse = require('hapi-pulse')
    pulse = require('./pulse.js').pulse
  })

  test('should export pulse with the correct structure', () => {
    expect(pulse).toHaveProperty('plugin')
    expect(pulse).toHaveProperty('options')
  })

  test('should use hapi-pulse as the plugin', () => {
    expect(pulse.plugin).toBe(hapiPulse)
  })

  test('should configure options with a logger', () => {
    expect(pulse.options.logger).toBeTruthy()
  })

  test('should set timeout to 10 seconds', () => {
    expect(pulse.options.timeout).toBe(10000) // 10 seconds in milliseconds
  })
})
