import {
  COMPLETED,
  INCOMPLETE
} from '../../../../shared/helpers/task-list-utils.js'

export const buildMarinePlanPolicyDocumentsRequired = (
  marinePlanPolicies = [],
  responses = {},
  marinePlanPolicyDocuments = []
) => {
  const linked = new Set(
    marinePlanPolicyDocuments.flatMap(({ policyLinks }) =>
      (policyLinks ?? []).map(({ policyCode }) => policyCode)
    )
  )

  return marinePlanPolicies
    .map(({ policyCode }) => policyCode)
    .filter(
      (policyCode) =>
        responses[policyCode]?.requiresDocumentation === true &&
        !linked.has(policyCode)
    )
}

export const getMarinePlanPolicyDocumentStatus = (documentsRequired = []) =>
  documentsRequired.length > 0 ? INCOMPLETE : COMPLETED
