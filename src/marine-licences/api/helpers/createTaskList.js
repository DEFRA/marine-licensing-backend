export const COMPLETED = 'COMPLETED'
export const IN_PROGRESS = 'IN_PROGRESS'
export const INCOMPLETE = 'INCOMPLETE'

export const createTaskList = (marineLicence, isCitizen = false) => {
  let tasks

  if (!isCitizen) {
    tasks = {
      projectName: (value) => (value ? COMPLETED : INCOMPLETE),
      specialLegalPowers: (value) => (value ? COMPLETED : INCOMPLETE)
    }
  } else {
    tasks = {
      projectName: (value) => (value ? COMPLETED : INCOMPLETE)
    }
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
