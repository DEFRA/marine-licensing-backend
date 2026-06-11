// Custom convict format that requires an env var override for vars that have non-prod default values set.
// Applied to sensitive configs like API URLs, credentials, and service endpoints.
export const requiredFromEnvInCdp = 'required-from-env-in-cdp'

export const isCdpProductionLikeEnvironment = (env) =>
  ['prod', 'perf-test', 'test'].includes(env)

export const isNotCdpProductionLikeEnvironment = (env) =>
  !isCdpProductionLikeEnvironment(env)

/**
 * 'required-from-env-in-cdp' format: When you must have an env var override the default value.
 * This is used for sensitive vars that take local-config default values and the prod values MUST come from the
 * environment.
 *
 * This is concerned with cdpEnvironments: prod (which is production), and perf-test (which is the equivalent of
 * pre-production), and test.
 */
export const convictRequiredFromEnvInCdp = {
  name: requiredFromEnvInCdp,
  validate: function (val, schema) {
    const env = process.env.ENVIRONMENT ?? 'local'
    // Validate that `requiredFromEnvInCdp` env vars are set from the environment on these CDP environments
    if (isNotCdpProductionLikeEnvironment(env)) {
      return
    }

    const invalidValues = schema.default === undefined ? [] : [schema.default] // never allow the default
    invalidValues.push('') // dont allow empty strings

    if (invalidValues.includes(val)) {
      throw new Error(
        `${schema.env || 'Configuration value'} must be set for ${env} environment (current value is invalid for production)`
      )
    }
  }
}
