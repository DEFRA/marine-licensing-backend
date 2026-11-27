import { buildPublicRegisterDynamicsPayload } from './build-public-register-dynamics-payload.js'
import { PUBLIC_REGISTER_WITHHOLD_REASON } from '../../constants/marine-licence.js'

const allNull = {
  withholdConsent: null,
  withholdReason: null,
  nationalSecurityApproval: null,
  reason: null
}

const commercialConfidentiality = {
  withholdConsent: 'yes',
  withholdReason: PUBLIC_REGISTER_WITHHOLD_REASON.COMMERCIAL_CONFIDENTIALITY,
  reason: 'Pricing in the contractor tender'
}

const nationalSecurityWithoutApproval = {
  withholdConsent: 'yes',
  withholdReason: PUBLIC_REGISTER_WITHHOLD_REASON.NATIONAL_SECURITY,
  nationalSecurityApproval: 'no'
}

const freeTextBeforeWithholdReason = {
  withholdConsent: 'yes',
  reason: 'Legacy free-text reason'
}

describe('buildPublicRegisterDynamicsPayload', () => {
  it.each([
    [
      'the applicant does not withhold',
      { withholdConsent: 'no' },
      { withholdConsent: 'no' }
    ],
    [
      'commercial confidentiality',
      commercialConfidentiality,
      commercialConfidentiality
    ],
    [
      'national security without approval',
      nationalSecurityWithoutApproval,
      nationalSecurityWithoutApproval
    ],
    [
      'free text saved before a withhold reason was asked',
      freeTextBeforeWithholdReason,
      freeTextBeforeWithholdReason
    ],
    ['the older consent-only shape', { consent: 'yes' }, {}],
    ['no answers', undefined, {}]
  ])('maps %s', (_, stored, expected) => {
    expect(buildPublicRegisterDynamicsPayload(stored)).toEqual({
      ...allNull,
      ...expected
    })
  })
})
