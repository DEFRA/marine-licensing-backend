import convict from 'convict'
import {
  isCdpProductionLikeEnvironment,
  isNotCdpProductionLikeEnvironment
} from './config.js'

describe('Config helper functions', () => {
  describe('#isCdpProductionLikeEnvironment', () => {
    test('Should return true for prod environment', () => {
      expect(isCdpProductionLikeEnvironment('prod')).toBe(true)
    })

    test('Should return true for perf-test environment', () => {
      expect(isCdpProductionLikeEnvironment('perf-test')).toBe(true)
    })

    test('Should return true for test environment', () => {
      expect(isCdpProductionLikeEnvironment('test')).toBe(true)
    })

    test('Should return false for local environment', () => {
      expect(isCdpProductionLikeEnvironment('local')).toBe(false)
    })

    test('Should return false for dev environment', () => {
      expect(isCdpProductionLikeEnvironment('dev')).toBe(false)
    })

    test('Should return false for empty string', () => {
      expect(isCdpProductionLikeEnvironment('')).toBe(false)
    })
  })

  describe('#isNotCdpProductionLikeEnvironment', () => {
    test('Should return false for prod environment', () => {
      expect(isNotCdpProductionLikeEnvironment('prod')).toBe(false)
    })

    test('Should return false for perf-test environment', () => {
      expect(isNotCdpProductionLikeEnvironment('perf-test')).toBe(false)
    })

    test('Should return false for test environment', () => {
      expect(isNotCdpProductionLikeEnvironment('test')).toBe(false)
    })

    test('Should return true for local environment', () => {
      expect(isNotCdpProductionLikeEnvironment('local')).toBe(true)
    })

    test('Should return true for dev environment', () => {
      expect(isNotCdpProductionLikeEnvironment('dev')).toBe(true)
    })

    test('Should return true for empty string', () => {
      expect(isNotCdpProductionLikeEnvironment('')).toBe(true)
    })
  })

  describe('requiredFromEnvInCdp format', () => {
    const originalEnv = process.env.ENVIRONMENT

    afterEach(() => {
      process.env.ENVIRONMENT = originalEnv
    })

    test('Should not throw for non-production-like environment with default value', () => {
      process.env.ENVIRONMENT = 'local'

      const testConfig = convict({
        testValue: {
          format: 'required-from-env-in-cdp',
          default: 'default-value',
          env: 'TEST_VALUE'
        }
      })

      expect(() => testConfig.validate({ allowed: 'strict' })).not.toThrow()
    })

    test('Should throw for production-like environment with default value', () => {
      process.env.ENVIRONMENT = 'prod'

      const testConfig = convict({
        testValue: {
          format: 'required-from-env-in-cdp',
          default: 'default-value',
          env: 'TEST_VALUE'
        }
      })

      expect(() => testConfig.validate({ allowed: 'strict' })).toThrow(
        /must be set for prod environment/
      )
    })

    test('Should throw for production-like environment with empty string', () => {
      process.env.ENVIRONMENT = 'test'
      process.env.TEST_VALUE = ''

      const testConfig = convict({
        testValue: {
          format: 'required-from-env-in-cdp',
          default: 'default-value',
          env: 'TEST_VALUE'
        }
      })

      expect(() => testConfig.validate({ allowed: 'strict' })).toThrow(
        /must be set for test environment/
      )
    })

    test('Should not throw for production-like environment with valid value', () => {
      process.env.ENVIRONMENT = 'perf-test'
      process.env.TEST_VALUE = 'valid-value'

      const testConfig = convict({
        testValue: {
          format: 'required-from-env-in-cdp',
          default: 'default-value',
          env: 'TEST_VALUE'
        }
      })

      expect(() => testConfig.validate({ allowed: 'strict' })).not.toThrow()
    })
  })
})
