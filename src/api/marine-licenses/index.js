import { createProjectNameController } from './controllers/create-project-name.js'

export const marineLicenses = [
  {
    method: 'POST',
    path: '/marine-license/project-name',
    ...createProjectNameController
  }
]
