import { computePolicyJobId, buildPolicyResetFields } from './policy-job.js'
import { mockFileUploadSite } from '../../../../../tests/test.fixture.js'

describe('computePolicyJobId', () => {
  const licenceId = '507f1f77bcf86cd799439011'

  const manualSite = {
    coordinatesType: 'coordinates',
    coordinatesEntry: 'single',
    coordinateSystem: 'wgs84',
    coordinates: { latitude: '51.5074', longitude: '-0.1278' },
    circleWidth: '100',
    siteName: 'Manual site'
  }

  it('should be deterministic for the same input', () => {
    expect(computePolicyJobId(licenceId, [mockFileUploadSite])).toBe(
      computePolicyJobId(licenceId, [mockFileUploadSite])
    )
  })

  it('should produce a 64-character hex hash', () => {
    expect(computePolicyJobId(licenceId, [manualSite])).toMatch(
      /^[a-f0-9]{64}$/
    )
  })

  it('should be insensitive to site order', () => {
    expect(
      computePolicyJobId(licenceId, [manualSite, mockFileUploadSite])
    ).toBe(computePolicyJobId(licenceId, [mockFileUploadSite, manualSite]))
  })

  it('should be insensitive to key order within a site', () => {
    const reordered = {
      circleWidth: manualSite.circleWidth,
      coordinates: manualSite.coordinates,
      coordinateSystem: manualSite.coordinateSystem,
      coordinatesEntry: manualSite.coordinatesEntry,
      coordinatesType: manualSite.coordinatesType
    }
    expect(computePolicyJobId(licenceId, [manualSite])).toBe(
      computePolicyJobId(licenceId, [reordered])
    )
  })

  it('should ignore non-geometry edits (site name, activity details)', () => {
    const renamed = {
      ...manualSite,
      siteName: 'A different name',
      activityDetails: [{ activityDescription: 'Dredging' }]
    }
    expect(computePolicyJobId(licenceId, [manualSite])).toBe(
      computePolicyJobId(licenceId, [renamed])
    )
  })

  it('should change when the coordinates change', () => {
    const moved = {
      ...manualSite,
      coordinates: { latitude: '52.0000', longitude: '-0.1278' }
    }
    expect(computePolicyJobId(licenceId, [manualSite])).not.toBe(
      computePolicyJobId(licenceId, [moved])
    )
  })

  it('should change when the licence id changes', () => {
    expect(computePolicyJobId(licenceId, [manualSite])).not.toBe(
      computePolicyJobId('507f1f77bcf86cd799439012', [manualSite])
    )
  })

  it('should handle empty site details', () => {
    expect(computePolicyJobId(licenceId)).toBe(
      computePolicyJobId(licenceId, [])
    )
  })
})

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
      marinePlanPolicyJobId: 'job-1',
      siteDetails: [site]
    }
    expect(buildPolicyResetFields(licenceId, existing, [site])).toEqual({})
  })

  it('should reset the policy state when the geometry changes', () => {
    const existing = {
      marinePlanPolicyJobId: 'job-1',
      siteDetails: [site]
    }
    const movedSite = {
      ...site,
      coordinates: { latitude: '52.0000', longitude: '-0.1278' }
    }

    expect(buildPolicyResetFields(licenceId, existing, [movedSite])).toEqual({
      marinePlanPolicyJob: null,
      marinePlanPolicyJobId: null,
      marinePlanPolicies: []
    })
  })

  it('should never reset marinePlanPolicyResponses', () => {
    const existing = { marinePlanPolicyJobId: 'job-1', siteDetails: [] }
    expect(
      buildPolicyResetFields(licenceId, existing, [site])
    ).not.toHaveProperty('marinePlanPolicyResponses')
  })
})
