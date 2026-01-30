export const COMPLETED = 'COMPLETED'
export const IN_PROGRESS = 'IN_PROGRESS'
export const INCOMPLETE = 'INCOMPLETE'

export const createTaskList = (marineLicense) => {
  const tasks = {
    projectName: (value) => (value ? COMPLETED : INCOMPLETE)
  }

  const taskList = {}

  for (const [taskName, decideStatus] of Object.entries(tasks)) {
    const status = decideStatus(marineLicense[taskName])
    if (status) {
      taskList[taskName] = status
    }
  }

  return taskList
}
