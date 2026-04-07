export const COMPLETED = 'COMPLETED'
export const IN_PROGRESS = 'IN_PROGRESS'
export const INCOMPLETE = 'INCOMPLETE'

export const getStatusFromRequiredFields = (obj, requiredFields) => {
  const missingKeys = requiredFields.filter((key) => !(key in obj))

  if (missingKeys.length === 0) {
    return COMPLETED
  }

  if (missingKeys.length === requiredFields.length) {
    return INCOMPLETE
  }

  return IN_PROGRESS
}

export const buildTaskList = (entity, tasks) => {
  const taskList = {}

  for (const [taskName, decideStatus] of Object.entries(tasks)) {
    const status = decideStatus(entity[taskName])
    if (status) {
      taskList[taskName] = status
    }
  }

  return taskList
}
