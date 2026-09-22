import { MARINE_LICENCE_STATUS_LABEL } from '../../constants/marine-licence.js'
import { filterCurrentPolicyResponses } from './marine-plan-policies/filter-current-policy-responses.js'
import { createTaskList, getSiteDetailsDataStatus } from './createTaskList.js'
import { COMPLETED } from '../../../shared/helpers/task-list-utils.js'
import { getOrganisationDetailsFromAuthToken } from '../../../shared/helpers/get-organisation-from-token.js'
import { isEntraIdUser } from '../../../shared/helpers/is-entra-id-user.js'
import { getDisplayStatus } from './application-tasks.js'

export const buildMarineLicenceResponse = (
  marineLicence,
  request,
  { includeApplicationTasks = false } = {}
) => {
  const { userRelationshipType } = getOrganisationDetailsFromAuthToken(
    request.auth
  )
  const isCitizen = userRelationshipType === 'Citizen'

  // Application tasks carry the caseworker's withholding comments, so they must never
  // reach the unauthenticated public register response, and nor must the fact that a
  // withholding decision is pending.
  const { _id, status, redactions, applicationTasks, ...rest } = marineLicence
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

  const toLabel = (value) => MARINE_LICENCE_STATUS_LABEL[value] || value
  const displayStatus = getDisplayStatus(marineLicence)

  return {
    id: _id.toString(),
    ...rest,
    ...(isEntraIdUser(request) && { redactions }),
    ...(includeApplicationTasks && {
      applicationTasks: applicationTasks ?? [],
      ...(displayStatus && { displayStatus })
    }),
    status: toLabel(status),
    marinePlanPolicyJob: rest.marinePlanPolicyJob ?? null,
    marinePlanPolicies: rest.marinePlanPolicies ?? [],
    marinePlanPolicyResponses,
    marinePlanPolicyResponseCount,
    taskList,
    siteDetailsDataComplete:
      getSiteDetailsDataStatus(marineLicence.siteDetails) === COMPLETED
  }
}
