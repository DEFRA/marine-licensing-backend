import { vi } from 'vitest'

describe('marine plan policies config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    [
      'prod',
      'https://environment.data.gov.uk/explore-marine-plans/api/policies'
    ],
    [
      'test',
      'https://environment-test.data.gov.uk/explore-marine-plans/api/policies'
    ]
  ])(
    'should default the GOV.UK policies URL for ENVIRONMENT=%s',
    async (environment, expectedUrl) => {
      vi.stubEnv('ENVIRONMENT', environment)
      vi.resetModules()

      const { marinePlanPoliciesSchema } =
        await import('./marine-plan-policies.js')

      expect(marinePlanPoliciesSchema.govukPoliciesUrl.default).toBe(
        expectedUrl
      )
    }
  )
})
