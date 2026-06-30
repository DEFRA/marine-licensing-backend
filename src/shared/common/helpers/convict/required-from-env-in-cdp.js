export const requiredFromEnvInCdp = 'required-from-env-in-cdp'

export const isCdpProductionLikeEnvironment = (env) =>
  ['prod', 'perf-test', 'test'].includes(env)

export const isNotCdpProductionLikeEnvironment = (env) =>
  !isCdpProductionLikeEnvironment(env)

export const convictRequiredFromEnvInCdp = {
  name: requiredFromEnvInCdp,
  validate: function (val, schema) {
    const env = process.env.ENVIRONMENT ?? 'local'
    if (isNotCdpProductionLikeEnvironment(env)) {
      return
    }

    const invalidValues = schema.default === undefined ? [] : [schema.default]
    invalidValues.push('')

    if (invalidValues.includes(val)) {
      throw new Error(
        `${schema.env || 'Configuration value'} must be set for ${env} environment (current value is invalid for production)`
      )
    }
  }
}
