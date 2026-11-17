import {
  COMPLETED,
  INCOMPLETE,
  NOT_REQUIRED
} from '../../../../shared/helpers/task-list-utils.js'

export const buildMarinePlanPoliciesRequiringDocuments = (
  marinePlanPolicies = [],
  responses = {}
) =>
  marinePlanPolicies
    .map(({ policyCode }) => policyCode)
    .filter(
      (policyCode) => responses[policyCode]?.requiresDocumentation === true
    )

export const buildMarinePlanPolicyDocumentsOutstanding = (
  requiringDocuments = [],
  marinePlanPolicyDocuments = []
) => {
  const hasLinkedDocument = new Set(
    marinePlanPolicyDocuments
      .flatMap((doc) => doc.policyLinks ?? [])
      .filter(({ location }) => location?.trim())
      .map(({ policyCode }) => policyCode)
  )

  return requiringDocuments.filter(
    (policyCode) => !hasLinkedDocument.has(policyCode)
  )
}

export const getMarinePlanPolicyDocumentStatus = (
  requiringDocuments = [],
  documentsOutstanding = []
) => {
  if (requiringDocuments.length === 0) {
    return NOT_REQUIRED
  }

  return documentsOutstanding.length > 0 ? INCOMPLETE : COMPLETED
}

export const buildMarinePlanPolicySupportingDocuments = (
  marinePlanPolicies = [],
  responses = {},
  marinePlanPolicyDocuments = []
) => {
  const documents = marinePlanPolicyDocuments ?? []
  const requiringDocuments = buildMarinePlanPoliciesRequiringDocuments(
    marinePlanPolicies,
    responses
  )
  const documentsOutstanding = buildMarinePlanPolicyDocumentsOutstanding(
    requiringDocuments,
    documents
  )

  return {
    documents,
    requiringDocuments,
    documentsOutstanding,
    status: getMarinePlanPolicyDocumentStatus(
      requiringDocuments,
      documentsOutstanding
    )
  }
}
