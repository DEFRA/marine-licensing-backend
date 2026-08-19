import {
  derivePolicyCodePrefix,
  filterPoliciesByPrefixes
} from './region-prefix.js'

describe('derivePolicyCodePrefix', () => {
  it.each([
    ['E_i', 'E-'],
    ['E_o', 'E-'],
    ['NE_i', 'NE-'],
    ['NE_o', 'NE-'],
    ['NW_i', 'NW-'],
    ['NW_o', 'NW-'],
    ['S_i', 'S-'],
    ['S_o', 'S-'],
    ['SE_i', 'SE-'],
    ['SW_i', 'SW-'],
    ['SW_o', 'SW-']
  ])('should derive %s -> %s', (regionref, prefix) => {
    expect(derivePolicyCodePrefix(regionref)).toBe(prefix)
  })

  it('should cover a novel conforming region automatically', () => {
    expect(derivePolicyCodePrefix('W_i')).toBe('W-')
  })
})

describe('filterPoliciesByPrefixes', () => {
  // Real codes from a captured ArcGIS response — the anchored
  // match is what stops S- matching SE-/SW- and E- matching NE-/SE-.
  const policies = [
    { policyCode: 'E-BIO-1', sector: 'Biodiversity' },
    { policyCode: 'NE-BIO-1', sector: 'Biodiversity' },
    { policyCode: 'SE-BIO-1', sector: 'Biodiversity' },
    { policyCode: 'S-BIO-1', sector: 'Biodiversity' },
    { policyCode: 'SW-BIO-1', sector: 'Biodiversity' }
  ]

  it('should match S- without matching SE- or SW-', () => {
    const { policies: matched } = filterPoliciesByPrefixes(policies, ['S-'])
    expect(matched.map((p) => p.policyCode)).toEqual(['S-BIO-1'])
  })

  it('should match E- without matching NE- or SE-', () => {
    const { policies: matched } = filterPoliciesByPrefixes(policies, ['E-'])
    expect(matched.map((p) => p.policyCode)).toEqual(['E-BIO-1'])
  })

  it('should union multiple prefixes', () => {
    const { policies: matched } = filterPoliciesByPrefixes(policies, [
      'NE-',
      'SW-'
    ])
    expect(matched.map((p) => p.policyCode).sort()).toEqual([
      'NE-BIO-1',
      'SW-BIO-1'
    ])
  })

  it('should report prefixes that matched nothing', () => {
    const { policies: matched, unmatchedPrefixes } = filterPoliciesByPrefixes(
      policies,
      ['W-', 'NE-']
    )
    expect(matched.map((p) => p.policyCode)).toEqual(['NE-BIO-1'])
    expect(unmatchedPrefixes).toEqual(['W-'])
  })
})
