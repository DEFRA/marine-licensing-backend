import {
  COMPLETED,
  INCOMPLETE,
  NOT_REQUIRED
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

export const getMarinePlanPolicyDocumentStatus = (
  responses = {},
  documentsRequired = []
) => {
  if (
    !Object.values(responses).some(
      ({ requiresDocumentation }) => requiresDocumentation === true
    )
  ) {
    return NOT_REQUIRED
  }

  return documentsRequired.length > 0 ? INCOMPLETE : COMPLETED
}
