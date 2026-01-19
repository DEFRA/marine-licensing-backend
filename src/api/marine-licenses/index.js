import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'

export const marineLicenses = [
  {
    method: 'POST',
    path: '/marine-license/project-name',
    ...createProjectNameController
  },
  {
    method: 'PATCH',
    path: '/marine-license/project-name',
    ...updateProjectNameController
  }
]
