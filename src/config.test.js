import convict from 'convict'
import {
  config,
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

// Schema defaults are asserted rather than resolved values, so the assertions
// hold regardless of what is set in the environment running the tests.
describe('Config schema defaults', () => {
  test('Should point the front end at the local dev server by default', () => {
    expect(config.default('frontEndBaseUrl')).toBe('http://localhost:3000')
  })

  test('Should point the backend gateway at the local dev server by default', () => {
    expect(config.default('backendGatewayUrl')).toBe('http://localhost:3001')
  })

  test('Should default the Defra ID JWKS URI to the local stub', () => {
    expect(config.default('defraId.jwksUri')).toBe(
      'http://localhost:3200/cdp-defra-id-stub/.well-known/jwks.json'
    )
  })

  test('Should default the Entra ID JWKS URI to the Microsoft discovery endpoint', () => {
    expect(config.default('entraId.jwksUri')).toBe(
      'https://login.microsoftonline.com/common/discovery/keys'
    )
  })

  test('Should default the upload bucket to the MMO uploads bucket', () => {
    expect(config.default('cdp.uploadBucket')).toBe('mmo-uploads')
  })

  test('Should default the maximum file size to 50MB', () => {
    expect(config.default('cdp.maxFileSize')).toBe(50_000_000)
  })

  test('Should default the S3 endpoint to localstack', () => {
    expect(config.default('aws.s3.endpoint')).toBe('http://localhost:4566')
  })

  test('Should default the CDP environment to local', () => {
    expect(config.default('cdpEnvironment')).toBe('local')
  })
})
