import { filterCurrentPolicyResponses } from './filter-current-policy-responses.js'

const answer = (response, requiresDocumentation = false) => ({
  response,
  requiresDocumentation
})

describe('filterCurrentPolicyResponses', () => {
  it('keeps responses whose policy code is in the current policy set', () => {
    const marinePlanPolicies = [{ policyCode: 'A' }, { policyCode: 'B' }]
    const marinePlanPolicyResponses = {
      A: answer('answer a'),
      B: answer('answer b', true)
    }

    expect(
      filterCurrentPolicyResponses(
        marinePlanPolicies,
        marinePlanPolicyResponses
      )
    ).toEqual({
      responses: { A: answer('answer a'), B: answer('answer b', true) },
      count: 2
    })
  })

  it('discards responses whose policy code is no longer in the current set', () => {
    const marinePlanPolicies = [{ policyCode: 'B' }]
    const marinePlanPolicyResponses = {
      A: answer('stale answer'),
      B: answer('answer b')
    }

    expect(
      filterCurrentPolicyResponses(
        marinePlanPolicies,
        marinePlanPolicyResponses
      )
    ).toEqual({ responses: { B: answer('answer b') }, count: 1 })
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
    const marinePlanPolicyResponses = { A: answer(''), B: answer('answer b') }

    expect(
      filterCurrentPolicyResponses(
        marinePlanPolicies,
        marinePlanPolicyResponses
      )
    ).toEqual({ responses: { A: answer(''), B: answer('answer b') }, count: 1 })
  })

  it('normalises legacy plain-string responses to the object shape', () => {
    const marinePlanPolicies = [{ policyCode: 'A' }, { policyCode: 'B' }]
    const marinePlanPolicyResponses = {
      A: 'legacy answer',
      B: answer('new answer', true)
    }

    expect(
      filterCurrentPolicyResponses(
        marinePlanPolicies,
        marinePlanPolicyResponses
      )
    ).toEqual({
      responses: { A: answer('legacy answer'), B: answer('new answer', true) },
      count: 2
    })
  })

  it('excludes legacy empty-string responses from the count', () => {
    expect(
      filterCurrentPolicyResponses([{ policyCode: 'A' }], { A: '' })
    ).toEqual({ responses: { A: answer('') }, count: 0 })
  })

  it('defaults to empty inputs when called with no arguments', () => {
    expect(filterCurrentPolicyResponses()).toEqual({ responses: {}, count: 0 })
  })
})
