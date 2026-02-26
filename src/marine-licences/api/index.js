import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'
import { getMarineLicenceController } from './controllers/get-marine-licence.js'
import { deleteMarineLicenseController } from './controllers/delete-marine-license.js'

export const marineLicences = [
  {
    method: 'GET',
    path: '/marine-licence/{id}',
    ...getMarineLicenceController
  },
  {
    method: 'POST',
    path: '/marine-licence/project-name',
    ...createProjectNameController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/project-name',
    ...updateProjectNameController
  },
  {
    method: 'DELETE',
    path: '/marine-license/{id}',
    ...deleteMarineLicenseController
  }
]
