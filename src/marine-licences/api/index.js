import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'
import { getMarineLicenseController } from './controllers/get-marine-license.js'
import { deleteMarineLicenseController } from './controllers/delete-marine-license.js'

export const marineLicenses = [
  {
    method: 'GET',
    path: '/marine-license/{id}',
    ...getMarineLicenseController
  },
  {
    method: 'POST',
    path: '/marine-license/project-name',
    ...createProjectNameController
  },
  {
    method: 'PATCH',
    path: '/marine-license/project-name',
    ...updateProjectNameController
  },
  {
    method: 'DELETE',
    path: '/marine-license/{id}',
    ...deleteMarineLicenseController
  }
]
