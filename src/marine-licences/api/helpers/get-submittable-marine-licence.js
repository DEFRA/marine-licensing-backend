import Boom from '@hapi/boom'
import { createTaskList } from './createTaskList.js'
import { filterCurrentPolicyResponses } from './marine-plan-policies/filter-current-policy-responses.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { getOrganisationDetailsFromAuthToken } from '../../../shared/helpers/get-organisation-from-token.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'

const checkForIncompleteTasks = (marineLicence, isCitizen) => {
  const { count: marinePlanPolicyResponseCount } = filterCurrentPolicyResponses(
    marineLicence.marinePlanPolicies,
    marineLicence.marinePlanPolicyResponses
  )
  const taskList = createTaskList(marineLicence, isCitizen, {
    marinePlanPolicyResponseCount
  })
  const incompleteTasks = Object.entries(taskList)
    .filter(([task]) => task !== 'waterFrameworkDirective') // Temporary until Water Framework Directive is complete
    .filter(([_task, status]) => status !== 'COMPLETED')
    .map(([task]) => task)

  if (incompleteTasks.length > 0) {
    throw Boom.badRequest(
      'Marine licence is incomplete. Missing sections: ' +
        incompleteTasks.join(', ')
    )
  }
}

export const getSubmittableMarineLicence = async (request, id) => {
  const { auth, db, logger } = request
  const marineLicence = await new MarineLicenceService({
    db,
    logger
  }).getMarineLicenceById({ id, currentUserId: getContactId(auth) })

  if (marineLicence.applicationReference) {
    throw Boom.conflict('Marine licence has already been submitted')
  }

  const { userRelationshipType } = getOrganisationDetailsFromAuthToken(auth)
  checkForIncompleteTasks(marineLicence, userRelationshipType === 'Citizen')

  return marineLicence
}
