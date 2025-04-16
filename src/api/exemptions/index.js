import { createProjectNameController } from './project-name/controllers/create-project-name.js'

export const exemptions = [
  {
    method: 'POST',
    path: '/exemption/project-name',
    ...createProjectNameController
  }
]
