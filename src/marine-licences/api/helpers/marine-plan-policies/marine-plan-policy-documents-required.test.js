import {
  buildMarinePlanPolicyDocumentsRequired,
  getMarinePlanPolicyDocumentStatus
} from './marine-plan-policy-documents-required.js'
import { filterCurrentPolicyResponses } from './filter-current-policy-responses.js'

const mockPolicyCode = 'E-AGG-1'

const policyResponseObject = (response, requiresDocumentation = false) => ({
  response,
  requiresDocumentation
})

const required = (marinePlanPolicies, marinePlanPolicyResponses, documents) =>
  buildMarinePlanPolicyDocumentsRequired(
    marinePlanPolicies,
    filterCurrentPolicyResponses(marinePlanPolicies, marinePlanPolicyResponses)
      .responses,
    documents
  )

describe('buildMarinePlanPolicyDocumentsRequired', () => {
  test('returns an empty array when no policies apply', () => {
    expect(
      required([], { A: policyResponseObject(mockPolicyCode, true) })
    ).toEqual([])
  })

  test('does not list a current policy that is not flagged', () => {
    const marinePlanPolicies = [{ policyCode: 'A' }]

    expect(
      required(marinePlanPolicies, {
        A: policyResponseObject(mockPolicyCode, false)
      })
    ).toEqual([])
  })

  test('orders the codes by the policy list, not by the response storage order', () => {
    const marinePlanPolicies = [
      { policyCode: 'A' },
      { policyCode: 'B' },
      { policyCode: 'C' }
    ]
    const marinePlanPolicyResponses = {
      C: policyResponseObject(mockPolicyCode, true),
      A: policyResponseObject(mockPolicyCode, true),
      B: policyResponseObject(mockPolicyCode, true)
    }

    expect(required(marinePlanPolicies, marinePlanPolicyResponses)).toEqual([
      'A',
      'B',
      'C'
    ])
  })

  test('excludes a flagged policy that a document links to', () => {
    const marinePlanPolicies = [{ policyCode: 'A' }, { policyCode: 'B' }]
    const marinePlanPolicyResponses = {
      A: policyResponseObject(mockPolicyCode, true),
      B: policyResponseObject(mockPolicyCode, true)
    }
    const marinePlanPolicyDocuments = [
      {
        documentId: 'doc-1',
        policyLinks: [{ policyCode: 'A' }, { policyCode: 'X' }]
      }
    ]

    expect(
      required(
        marinePlanPolicies,
        marinePlanPolicyResponses,
        marinePlanPolicyDocuments
      )
    ).toEqual(['B'])
  })
})

describe('getMarinePlanPolicyDocumentStatus', () => {
  test('returns INCOMPLETE when any policy still requires a document', () => {
    expect(getMarinePlanPolicyDocumentStatus(['A'])).toBe('INCOMPLETE')
  })

  test('returns COMPLETED when no policy requires a document', () => {
    expect(getMarinePlanPolicyDocumentStatus([])).toBe('COMPLETED')
  })

  test('defaults to COMPLETED when called with no arguments', () => {
    expect(getMarinePlanPolicyDocumentStatus()).toBe('COMPLETED')
  })
})
