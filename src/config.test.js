import { vi } from 'vitest'
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
    const originalTestValue = process.env.TEST_VALUE

    // Assigning undefined to process.env stores the string "undefined", which
    // leaks into anything that reads ENVIRONMENT later, so an unset variable
    // has to be restored by deleting it.
    const restore = (key, value) => {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    afterEach(() => {
      restore('ENVIRONMENT', originalEnv)
      restore('TEST_VALUE', originalTestValue)
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

// Reloading the module re-runs the convict schema against a modified
// environment, so these exercise the env plumbing rather than restating the
// literals that already live in config.js.
const loadConfigWithEnv = async (env) => {
  // Each key is restored individually - replacing process.env wholesale swaps
  // the live environment object for a plain one and convict then reads nothing
  // back from it.
  const previousEnv = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]])
  )
  Object.assign(process.env, env)
  vi.resetModules()

  try {
    return (await import('./config.js')).config
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

describe('Config environment plumbing', () => {
  afterAll(() => {
    vi.resetModules()
  })

  test.each([
    ['frontEndBaseUrl', 'FRONTEND_BASE_URL', 'https://frontend.example.gov.uk'],
    [
      'backendGatewayUrl',
      'BACKEND_GATEWAY_URL',
      'https://gateway.example.gov.uk'
    ],
    [
      'defraId.jwksUri',
      'DEFRA_ID_JWKS_URI',
      'https://defra.example.gov.uk/jwks'
    ],
    [
      'entraId.jwksUri',
      'ENTRA_ID_JWKS_URI',
      'https://entra.example.gov.uk/jwks'
    ],
    ['cdp.uploadBucket', 'CDP_UPLOAD_BUCKET', 'some-other-bucket'],
    ['aws.s3.endpoint', 'S3_ENDPOINT', 'https://s3.example.gov.uk'],
    ['cdpEnvironment', 'ENVIRONMENT', 'dev']
  ])('Should read %s from %s', async (key, envVar, value) => {
    const reloaded = await loadConfigWithEnv({ [envVar]: value })

    expect(reloaded.get(key)).toBe(value)
  })

  test('Should coerce MAX_FILE_SIZE to a number', async () => {
    const reloaded = await loadConfigWithEnv({ MAX_FILE_SIZE: '1234' })

    expect(reloaded.get('cdp.maxFileSize')).toBe(1234)
  })
})

// These deliberately restate the literals in config.js. Duplication is the
// point: a silently changed default is exactly the failure being guarded
// against, and nothing else in the suite reads a default rather than a mocked
// value. Schema defaults are asserted rather than resolved values, so the
// assertions hold regardless of what is set in the environment running them.
describe('Config schema defaults', () => {
  test.each([
    ['frontEndBaseUrl', 'http://localhost:3000'],
    ['backendGatewayUrl', 'http://localhost:3001'],
    [
      'defraId.jwksUri',
      'http://localhost:3200/cdp-defra-id-stub/.well-known/jwks.json'
    ],
    [
      'entraId.jwksUri',
      'https://login.microsoftonline.com/common/discovery/keys'
    ],
    ['cdp.uploadBucket', 'mmo-uploads'],
    ['cdp.maxFileSize', 50_000_000],
    ['aws.s3.endpoint', 'http://localhost:4566'],
    ['cdpEnvironment', 'local']
  ])('Should default %s to %s', (key, expected) => {
    expect(config.default(key)).toBe(expected)
  })
})
