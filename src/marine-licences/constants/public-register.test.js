import { buildPublicRegisterDynamicsPayload } from './public-register.js'
import { PUBLIC_REGISTER_WITHHOLD_REASON } from './marine-licence.js'

const allNull = {
  withholdConsent: null,
  withholdReason: null,
  nationalSecurityApproval: null,
  reason: null
}

describe('buildPublicRegisterDynamicsPayload', () => {
  it('sends only the consent answer when the applicant does not withhold', () => {
    expect(
      buildPublicRegisterDynamicsPayload({ withholdConsent: 'no' })
    ).toEqual({ ...allNull, withholdConsent: 'no' })
  })

  it('sends the reason and details for commercial confidentiality', () => {
    expect(
      buildPublicRegisterDynamicsPayload({
        withholdConsent: 'yes',
        withholdReason:
          PUBLIC_REGISTER_WITHHOLD_REASON.COMMERCIAL_CONFIDENTIALITY,
        reason: 'Pricing in the contractor tender'
      })
    ).toEqual({
      withholdConsent: 'yes',
      withholdReason:
        PUBLIC_REGISTER_WITHHOLD_REASON.COMMERCIAL_CONFIDENTIALITY,
      nationalSecurityApproval: null,
      reason: 'Pricing in the contractor tender'
    })
  })

  it('sends approval and details for national security with approval', () => {
    const publicRegister = {
      withholdConsent: 'yes',
      withholdReason: PUBLIC_REGISTER_WITHHOLD_REASON.NATIONAL_SECURITY,
      nationalSecurityApproval: 'yes',
      reason: 'Cable landing point, site 2, approved by MOD on 1 March 2026'
    }

    expect(buildPublicRegisterDynamicsPayload(publicRegister)).toEqual(
      publicRegister
    )
  })

  it('sends approval without details for national security without approval', () => {
    expect(
      buildPublicRegisterDynamicsPayload({
        withholdConsent: 'yes',
        withholdReason: PUBLIC_REGISTER_WITHHOLD_REASON.NATIONAL_SECURITY,
        nationalSecurityApproval: 'no'
      })
    ).toEqual({
      withholdConsent: 'yes',
      withholdReason: PUBLIC_REGISTER_WITHHOLD_REASON.NATIONAL_SECURITY,
      nationalSecurityApproval: 'no',
      reason: null
    })
  })

  it('sends all nulls when there are no answers', () => {
    expect(buildPublicRegisterDynamicsPayload(undefined)).toEqual(allNull)
  })

  it('passes through free text saved before a withhold reason was asked', () => {
    expect(
      buildPublicRegisterDynamicsPayload({
        withholdConsent: 'yes',
        reason: 'Legacy free-text reason'
      })
    ).toEqual({
      ...allNull,
      withholdConsent: 'yes',
      reason: 'Legacy free-text reason'
    })
  })

  it('sends all nulls for the older consent-only shape', () => {
    expect(buildPublicRegisterDynamicsPayload({ consent: 'yes' })).toEqual(
      allNull
    )
  })
})
