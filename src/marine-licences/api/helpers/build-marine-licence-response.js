import { MARINE_LICENCE_STATUS_LABEL } from '../../constants/marine-licence.js'
import { filterCurrentPolicyResponses } from './marine-plan-policies/filter-current-policy-responses.js'
import { createTaskList, getSiteDetailsDataStatus } from './createTaskList.js'
import { COMPLETED } from '../../../shared/helpers/task-list-utils.js'
import { getOrganisationDetailsFromAuthToken } from '../../../shared/helpers/get-organisation-from-token.js'
import { isEntraIdUser } from '../../../shared/helpers/is-entra-id-user.js'

export const buildMarineLicenceResponse = (marineLicence, request) => {
  const { userRelationshipType } = getOrganisationDetailsFromAuthToken(
    request.auth
  )
  const isCitizen = userRelationshipType === 'Citizen'

  const { _id, status, redactions, ...rest } = marineLicence
  const {
    responses: marinePlanPolicyResponses,
    count: marinePlanPolicyResponseCount
  } = filterCurrentPolicyResponses(
    rest.marinePlanPolicies,
    rest.marinePlanPolicyResponses
  )
  const taskList = createTaskList(marineLicence, isCitizen, {
    marinePlanPolicyResponseCount
  })

  return {
    id: _id.toString(),
    ...rest,
    ...(isEntraIdUser(request) && { redactions }),
    status: MARINE_LICENCE_STATUS_LABEL[status] || status,
    marinePlanPolicyJob: rest.marinePlanPolicyJob ?? null,
    marinePlanPolicies: rest.marinePlanPolicies ?? [],
    marinePlanPolicyResponses,
    marinePlanPolicyResponseCount,
    taskList,
    siteDetailsDataComplete:
      getSiteDetailsDataStatus(marineLicence.siteDetails) === COMPLETED
  }
}
