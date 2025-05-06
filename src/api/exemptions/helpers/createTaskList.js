export const COMPLETED = 'COMPLETED'
export const NOT_STARTED = false

export const createTaskList = (exemption) => {
  const taskList = {
    publicRegister: exemption.publicRegister ? COMPLETED : NOT_STARTED,
    projectName: exemption.projectName ? COMPLETED : NOT_STARTED
  }

  return taskList
}
