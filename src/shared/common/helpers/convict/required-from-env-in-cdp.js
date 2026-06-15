export const requiredFromEnvInCdp = 'required-from-env-in-cdp'

export const isCdpProductionLikeEnvironment = (env) =>
  ['prod', 'perf-test', 'test'].includes(env)

export const isNotCdpProductionLikeEnvironment = (env) =>
  !isCdpProductionLikeEnvironment(env)

// Rejects the configured default in prod/perf-test/test CDP environments, forcing the value to come from an env var.
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
