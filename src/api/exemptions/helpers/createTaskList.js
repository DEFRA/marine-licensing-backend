export const COMPLETED = 'COMPLETED'

export const createTaskList = (exemption) => {
  const tasks = {
    publicRegister: (value) => (value ? COMPLETED : null),
    projectName: (value) => (value ? COMPLETED : null)
  }

  const taskList = {}

  Object.entries(tasks).forEach(([taskName, decideStatus]) => {
    const status = decideStatus(exemption[taskName])
    if (status) {
      taskList[taskName] = status
    }
  })

  return taskList
}
