export const COMPLETED = 'COMPLETED'
export const IN_PROGRESS = 'IN_PROGRESS'
export const INCOMPLETE = 'INCOMPLETE'

export const createTaskList = (marineLicence, isCitizen = false) => {
  const tasks = {
    projectName: (value) => (value ? COMPLETED : INCOMPLETE),
    ...(!isCitizen && {
      specialLegalPowers: (value) => (value ? COMPLETED : INCOMPLETE)
    }),
    otherAuthorities: (value) => (value ? COMPLETED : INCOMPLETE),
    projectBackground: (value) => (value ? COMPLETED : INCOMPLETE)
  }

  const taskList = {}

  for (const [taskName, decideStatus] of Object.entries(tasks)) {
    const status = decideStatus(marineLicence[taskName])
    if (status) {
      taskList[taskName] = status
    }
  }

  return taskList
}
