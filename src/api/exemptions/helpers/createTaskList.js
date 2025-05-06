export const COMPLETED = 'COMPLETED'

export const createTaskList = (exemption) => {
  const taskList = {
    ...(exemption.publicRegister && { publicRegister: COMPLETED }),
    ...(exemption.projectName && { projectName: COMPLETED })
  }

  return taskList
}
