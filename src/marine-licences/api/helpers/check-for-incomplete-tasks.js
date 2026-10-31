import Boom from '@hapi/boom'
import { createTaskList } from './createTaskList.js'
import { filterCurrentPolicyResponses } from './marine-plan-policies/filter-current-policy-responses.js'

export const checkForIncompleteTasks = (marineLicence, isCitizen) => {
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
