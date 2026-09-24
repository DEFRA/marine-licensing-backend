import { DISPLAY_STATUS } from '../../../shared/constants/project-status.js'

const hasOutstandingApplicationTask = ({ applicationTasks } = {}) =>
  (applicationTasks ?? []).some((task) => !task.resolvedAt)

// Display only: `status` remains the lifecycle status, so nothing deciding what can be
// withdrawn, copied or published needs to know this exists.
export const getDisplayStatus = (marineLicence) =>
  hasOutstandingApplicationTask(marineLicence)
    ? DISPLAY_STATUS.ACTION_REQUIRED
    : undefined
