import { buildPolicyResetFields } from './policy-reset.js'
import { computePolicyJobId } from './policy-job-hash.js'

describe('buildPolicyResetFields', () => {
  const licenceId = '507f1f77bcf86cd799439011'
  const site = {
    coordinatesType: 'coordinates',
    coordinatesEntry: 'single',
    coordinateSystem: 'wgs84',
    coordinates: { latitude: '51.5074', longitude: '-0.1278' },
    circleWidth: '100'
  }

  it('should return no fields when there is no policy job', () => {
    expect(buildPolicyResetFields(licenceId, {}, [site])).toEqual({})
    expect(buildPolicyResetFields(licenceId, null, [site])).toEqual({})
  })

  it('should return no fields when the geometry is unchanged', () => {
    const existing = {
      marinePlanPolicyJobId: computePolicyJobId(licenceId, [site])
    }
    expect(buildPolicyResetFields(licenceId, existing, [site])).toEqual({})
  })

  it('should reset the policy state when the geometry changes', () => {
    const existing = {
      marinePlanPolicyJobId: computePolicyJobId(licenceId, [site])
    }
    const movedSite = {
      ...site,
      coordinates: { latitude: '52.0000', longitude: '-0.1278' }
    }

    expect(buildPolicyResetFields(licenceId, existing, [movedSite])).toEqual({
      marinePlanPolicyJob: null,
      marinePlanPolicyJobId: null,
      marinePlanPolicyJobQueuedAt: null,
      marinePlanPolicies: []
    })
  })

  it('should never reset marinePlanPolicyResponses', () => {
    const existing = { marinePlanPolicyJobId: 'a-stale-hash' }
    expect(
      buildPolicyResetFields(licenceId, existing, [site])
    ).not.toHaveProperty('marinePlanPolicyResponses')
  })
})
