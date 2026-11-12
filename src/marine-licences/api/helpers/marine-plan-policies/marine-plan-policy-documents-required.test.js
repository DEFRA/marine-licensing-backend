import {
  buildMarinePlanPoliciesRequiringDocuments,
  buildMarinePlanPolicyDocumentsOutstanding,
  getMarinePlanPolicyDocumentStatus
} from './marine-plan-policy-documents-required.js'
import { filterCurrentPolicyResponses } from './filter-current-policy-responses.js'
import {
  COMPLETED,
  INCOMPLETE,
  NOT_REQUIRED
} from '../../../../shared/helpers/task-list-utils.js'

const mockPolicyCode = 'E-AGG-1'

const policyResponseObject = (response, requiresDocumentation = false) => ({
  response,
  requiresDocumentation
})

const requiringDocuments = (marinePlanPolicies, marinePlanPolicyResponses) =>
  buildMarinePlanPoliciesRequiringDocuments(
    marinePlanPolicies,
    filterCurrentPolicyResponses(marinePlanPolicies, marinePlanPolicyResponses)
      .responses
  )

describe('buildMarinePlanPoliciesRequiringDocuments', () => {
  test('returns an empty array when no policies apply', () => {
    expect(
      requiringDocuments([], { A: policyResponseObject(mockPolicyCode, true) })
    ).toEqual([])
  })

  test('does not list a current policy that does not require documents', () => {
    expect(
      requiringDocuments([{ policyCode: 'A' }, { policyCode: 'B' }], {
        A: policyResponseObject(mockPolicyCode, false),
        B: policyResponseObject('E-AGG-2', true)
      })
    ).toEqual(['B'])
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

    expect(
      requiringDocuments(marinePlanPolicies, marinePlanPolicyResponses)
    ).toEqual(['A', 'B', 'C'])
  })

  test('defaults to an empty array when called with no arguments', () => {
    expect(buildMarinePlanPoliciesRequiringDocuments()).toEqual([])
  })
})

describe('buildMarinePlanPolicyDocumentsOutstanding', () => {
  test('lists every policy requiring documents when no documents are stored', () => {
    expect(buildMarinePlanPolicyDocumentsOutstanding(['A', 'B'])).toEqual([
      'A',
      'B'
    ])
  })

  test('excludes a policy requiring documents that a document links to with a location', () => {
    const marinePlanPolicyDocuments = [
      {
        documentId: 'doc-1',
        policyLinks: [
          { policyCode: 'A', location: 'Section 4.2' },
          { policyCode: 'X', location: 'Page 1' }
        ]
      }
    ]

    expect(
      buildMarinePlanPolicyDocumentsOutstanding(
        ['A', 'B'],
        marinePlanPolicyDocuments
      )
    ).toEqual(['B'])
  })

  test('keeps a policy requiring documents whose link has no location', () => {
    const marinePlanPolicyDocuments = [
      {
        documentId: 'doc-1',
        policyLinks: [{ policyCode: 'A' }, { policyCode: 'B', location: '   ' }]
      }
    ]

    expect(
      buildMarinePlanPolicyDocumentsOutstanding(
        ['A', 'B'],
        marinePlanPolicyDocuments
      )
    ).toEqual(['A', 'B'])
  })

  test('ignores documents that have no links yet', () => {
    expect(
      buildMarinePlanPolicyDocumentsOutstanding(
        ['A'],
        [{ documentId: 'doc-1' }]
      )
    ).toEqual(['A'])
  })

  test('defaults to an empty array when called with no arguments', () => {
    expect(buildMarinePlanPolicyDocumentsOutstanding()).toEqual([])
  })
})

describe('getMarinePlanPolicyDocumentStatus', () => {
  test('returns NOT_REQUIRED when no policy requires documents', () => {
    expect(getMarinePlanPolicyDocumentStatus([], [])).toBe(NOT_REQUIRED)
  })

  test('returns INCOMPLETE when a policy requiring documents still has none', () => {
    expect(getMarinePlanPolicyDocumentStatus(['A'], ['A'])).toBe(INCOMPLETE)
  })

  test('returns COMPLETED when every policy requiring documents has one', () => {
    expect(getMarinePlanPolicyDocumentStatus(['A'], [])).toBe(COMPLETED)
  })

  test('defaults to NOT_REQUIRED when called with no arguments', () => {
    expect(getMarinePlanPolicyDocumentStatus()).toBe(NOT_REQUIRED)
  })
})
