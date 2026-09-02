import { formatMarinePlanPoliciesForGateway } from './format-marine-plan-policies-for-gateway.js'

describe('formatMarinePlanPoliciesForGateway', () => {
  it('should map policy code, policy information and applicant answer', () => {
    const policies = [
      {
        policyCode: 'SW-CC-1',
        sector: 'Cross-cutting',
        policy: '<p>Proposals that conserve habitats will be supported.</p>'
      },
      {
        policyCode: 'SW-AQ-2',
        sector: 'Aquaculture',
        policy: '<p>Aquaculture policy statement.</p>'
      }
    ]

    expect(
      formatMarinePlanPoliciesForGateway(policies, {
        'SW-CC-1': 'No impact on flood defence habitats.',
        'SW-AQ-2': ''
      })
    ).toEqual([
      {
        policyCode: 'SW-CC-1',
        policyInformation:
          '<p>Proposals that conserve habitats will be supported.</p>',
        applicantAnswer: 'No impact on flood defence habitats.'
      },
      {
        policyCode: 'SW-AQ-2',
        policyInformation: '<p>Aquaculture policy statement.</p>',
        applicantAnswer: ''
      }
    ])
  })

  it('should omit sector and other wording fields from the gateway payload', () => {
    const policies = [
      {
        policyCode: 'E-AGG-1',
        sector: 'Aggregates',
        policy: '<p>statement</p>',
        policyAim: '<p>aim</p>',
        whatIsIt: '<p>what</p>'
      }
    ]

    expect(formatMarinePlanPoliciesForGateway(policies, {})).toEqual([
      {
        policyCode: 'E-AGG-1',
        policyInformation: '<p>statement</p>',
        applicantAnswer: null
      }
    ])
  })

  it('should return an empty array when no policies are stored', () => {
    expect(formatMarinePlanPoliciesForGateway()).toEqual([])
  })
})
