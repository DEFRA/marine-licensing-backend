import { ACTION_REQUIRED_STATUS_LABEL } from '../constants/project-status.js'

// The single place the derived "Action required" rule lives. If the team reverts to
// storing the status on the project, getDisplayStatus becomes a pass-through and
// outstandingTasksQuery becomes { status: 'ACTION_REQUIRED' }; no caller changes.
export const outstandingTasksQuery = {
  applicationTasks: { $elemMatch: { resolvedAt: null } }
}

export const noOutstandingTasksQuery = {
  applicationTasks: { $not: { $elemMatch: { resolvedAt: null } } }
}

// `== null` rather than falsy, so this agrees exactly with what the Mongo
// predicates above match (null or missing).
export const hasOutstandingApplicationTasks = (applicationTasks) =>
  (applicationTasks ?? []).some((task) => task?.resolvedAt == null)

export const getDisplayStatus = ({ status, applicationTasks }) => {
  if (hasOutstandingApplicationTasks(applicationTasks)) {
    return ACTION_REQUIRED_STATUS_LABEL
  }

  return status
}
