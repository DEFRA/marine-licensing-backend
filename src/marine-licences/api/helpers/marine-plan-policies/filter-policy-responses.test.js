import { filterCurrentPolicyResponses } from './filter-policy-responses.js'

describe('filterCurrentPolicyResponses', () => {
  it('keeps responses whose policy code is in the current policy set', () => {
    const marinePlanPolicies = [{ policyCode: 'A' }, { policyCode: 'B' }]
    const marinePlanPolicyResponses = { A: 'answer a', B: 'answer b' }

    expect(
      filterCurrentPolicyResponses(
        marinePlanPolicies,
        marinePlanPolicyResponses
      )
    ).toEqual({ responses: { A: 'answer a', B: 'answer b' }, count: 2 })
  })

  it('discards responses whose policy code is no longer in the current set', () => {
    const marinePlanPolicies = [{ policyCode: 'B' }]
    const marinePlanPolicyResponses = { A: 'stale answer', B: 'answer b' }

    expect(
      filterCurrentPolicyResponses(
        marinePlanPolicies,
        marinePlanPolicyResponses
      )
    ).toEqual({ responses: { B: 'answer b' }, count: 1 })
  })

  it('returns an empty result when there is no overlap between old and new sets', () => {
    const marinePlanPolicies = [{ policyCode: 'NEW-1' }]
    const marinePlanPolicyResponses = { 'OLD-1': 'stale answer' }

    expect(
      filterCurrentPolicyResponses(
        marinePlanPolicies,
        marinePlanPolicyResponses
      )
    ).toEqual({ responses: {}, count: 0 })
  })

  it('returns an empty result when no policies currently apply', () => {
    expect(filterCurrentPolicyResponses([], { A: 'stale answer' })).toEqual({
      responses: {},
      count: 0
    })
  })

  it('excludes empty-string responses from the count', () => {
    const marinePlanPolicies = [{ policyCode: 'A' }, { policyCode: 'B' }]
    const marinePlanPolicyResponses = { A: '', B: 'answer b' }

    expect(
      filterCurrentPolicyResponses(
        marinePlanPolicies,
        marinePlanPolicyResponses
      )
    ).toEqual({ responses: { A: '', B: 'answer b' }, count: 1 })
  })

  it('defaults to empty inputs when called with no arguments', () => {
    expect(filterCurrentPolicyResponses()).toEqual({ responses: {}, count: 0 })
  })
})
