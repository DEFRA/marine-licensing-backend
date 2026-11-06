import { buildMarineLicenceResponse } from './build-marine-licence-response.js'
import {
  requestFromApplicantUser,
  requestFromInternalUser,
  requestFromPublicUser
} from '../../../../.vite/mocks.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import {
  mockCompleteSite,
  mockRedactions
} from '../../../../tests/test.fixture.js'

describe('buildMarineLicenceResponse', () => {
  const mockId = '123456789123456789123456'

  it('should map a marine licence into the response shape', () => {
    const marineLicence = {
      _id: mockId,
      projectName: 'Test project',
      contactId: 'abc',
      feeEstimate: { accept: 'yes', termsAndConditions: true, feeBand: '2A' },
      harbourAuthority: {
        area: 'yes',
        details: 'Harbour authority details'
      }
    }

    const response = buildMarineLicenceResponse(
      marineLicence,
      requestFromApplicantUser({ userContactId: 'abc' })
    )

    expect(response).toEqual({
      id: mockId,
      projectName: 'Test project',
      contactId: 'abc',
      feeEstimate: { accept: 'yes', termsAndConditions: true, feeBand: '2A' },
      harbourAuthority: {
        area: 'yes',
        details: 'Harbour authority details'
      },
      marinePlanPolicyJob: null,
      marinePlanPolicies: [],
      marinePlanPolicyResponses: {},
      marinePlanPolicyResponseCount: 0,
      marinePlanPolicySupportingDocuments: {
        documents: [],
        required: [],
        status: 'NOT_REQUIRED'
      },
      taskList: expect.any(Object),
      siteDetailsDataComplete: false
    })
  })

  it('should filter marinePlanPolicyResponses down to the current policy set and count only those', () => {
    const marineLicence = {
      _id: mockId,
      projectName: 'Test project',
      contactId: 'abc',
      marinePlanPolicyJob: 'ready',
      marinePlanPolicies: [
        { policyCode: 'NEW-1', sector: 'sector-a' },
        { policyCode: 'NEW-2', sector: 'sector-a' }
      ],
      marinePlanPoliciesCount: 2,
      marinePlanPolicyResponses: {
        'OLD-1': {
          response: 'a stale answer from a previous site',
          requiresDocumentation: false
        },
        'NEW-1': {
          response: 'answer for the current set',
          requiresDocumentation: true
        }
      },
      marinePlanPolicyResponseCount: 2
    }

    const response = buildMarineLicenceResponse(
      marineLicence,
      requestFromApplicantUser({ userContactId: 'abc' })
    )

    expect(response.marinePlanPolicyResponses).toEqual({
      'NEW-1': {
        response: 'answer for the current set',
        requiresDocumentation: true
      }
    })
    expect(response.marinePlanPolicyResponseCount).toBe(1)
    expect(response.taskList.marinePlanPolicies).toBe('IN_PROGRESS')
  })

  it('should group supporting documents with the policies still requiring one and their status', () => {
    const marinePlanPolicyDocuments = [
      { documentId: 'doc-1', policyLinks: [{ policyCode: 'C' }] }
    ]
    const marineLicence = {
      _id: mockId,
      projectName: 'Test project',
      contactId: 'abc',
      marinePlanPolicies: [
        { policyCode: 'A', sector: 'sector-a' },
        { policyCode: 'B', sector: 'sector-a' },
        { policyCode: 'C', sector: 'sector-a' }
      ],
      marinePlanPolicyResponses: {
        // Stored out of page order; the required list follows marinePlanPolicies
        B: { response: '', requiresDocumentation: true },
        // No longer a current policy, so dropped
        D: { response: 'stale', requiresDocumentation: true },
        // Flagged, but a document links to it
        C: { response: 'answered', requiresDocumentation: true },
        A: { response: 'answered', requiresDocumentation: false }
      },
      marinePlanPolicyDocuments
    }

    const response = buildMarineLicenceResponse(
      marineLicence,
      requestFromApplicantUser({ userContactId: 'abc' })
    )

    expect(response.marinePlanPolicySupportingDocuments).toEqual({
      documents: marinePlanPolicyDocuments,
      required: ['B'],
      status: 'INCOMPLETE'
    })
    expect(response).not.toHaveProperty('marinePlanPolicyDocuments')
  })

  it('should report siteDetailsDataComplete as true when site data is valid regardless of siteDetailsConfirmed', () => {
    const marineLicence = {
      _id: mockId,
      projectName: 'Test project',
      contactId: 'abc',
      siteDetails: [mockCompleteSite],
      siteDetailsConfirmed: false
    }

    const response = buildMarineLicenceResponse(
      marineLicence,
      requestFromApplicantUser({ userContactId: 'abc' })
    )

    expect(response.siteDetailsDataComplete).toBe(true)
  })

  it('should report siteDetailsDataComplete as false when site data is invalid even if siteDetailsConfirmed is true', () => {
    const marineLicence = {
      _id: mockId,
      projectName: 'Test project',
      contactId: 'abc',
      siteDetails: [],
      siteDetailsConfirmed: true
    }

    const response = buildMarineLicenceResponse(
      marineLicence,
      requestFromApplicantUser({ userContactId: 'abc' })
    )

    expect(response.siteDetailsDataComplete).toBe(false)
  })

  it('should return the mapped status label rather than the raw status', () => {
    const marineLicence = {
      _id: mockId,
      projectName: 'Test project',
      contactId: 'abc',
      status: MARINE_LICENCE_STATUS.ACTIVE
    }

    const response = buildMarineLicenceResponse(
      marineLicence,
      requestFromApplicantUser({ userContactId: 'abc' })
    )

    expect(response.status).toBe('Active')
  })

  it.each([
    ['an applicant', requestFromApplicantUser({ userContactId: 'abc' })],
    ['an internal (Entra ID) user', requestFromInternalUser()],
    ['an unauthenticated (public) request', requestFromPublicUser()]
  ])('should not include consultation requests for %s', (_, request) => {
    const marineLicence = {
      _id: mockId,
      contactId: 'abc',
      consultationRequests: [
        { consultees: [{ organisationId: 'org-1', response: 'No objection' }] }
      ]
    }

    const response = buildMarineLicenceResponse(marineLicence, request)

    expect(response).not.toHaveProperty('consultationRequests')
  })

  describe('Redactions', () => {
    const redactions = mockRedactions

    it('should include redactions for an internal (Entra ID) user', () => {
      const marineLicence = {
        _id: mockId,
        projectName: 'Test project',
        contactId: 'someone-elses-id',
        redactions
      }

      const response = buildMarineLicenceResponse(
        marineLicence,
        requestFromInternalUser()
      )

      expect(response.redactions).toEqual(redactions)
    })

    it('should not include redactions for an applicant', () => {
      const marineLicence = {
        _id: mockId,
        projectName: 'Test project',
        contactId: 'abc',
        redactions
      }

      const response = buildMarineLicenceResponse(
        marineLicence,
        requestFromApplicantUser({ userContactId: 'abc' })
      )

      expect(response).not.toHaveProperty('redactions')
    })

    it('should not include redactions for an unauthenticated (public) request', () => {
      const marineLicence = {
        _id: mockId,
        projectName: 'Test project',
        contactId: 'abc',
        redactions
      }

      const response = buildMarineLicenceResponse(
        marineLicence,
        requestFromPublicUser()
      )

      expect(response).not.toHaveProperty('redactions')
    })
  })
})
