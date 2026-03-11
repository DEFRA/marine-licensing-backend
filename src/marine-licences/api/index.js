import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'
import { getMarineLicenceController } from './controllers/get-marine-licence.js'
import { deleteMarineLicenceController } from './controllers/delete-marine-licence.js'
import { submitMarineLicenceController } from './controllers/submit-marine-licence.js'

export const marineLicences = [
  {
    method: 'GET',
    path: '/marine-licence/{id}',
    ...getMarineLicenceController({ requiresAuth: true })
  },
  {
    method: 'GET',
    path: '/public/marine-licence/{id}',
    ...getMarineLicenceController({ requiresAuth: false })
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
    path: '/marine-licence/{id}',
    ...deleteMarineLicenceController
  },
  {
    method: 'POST',
    path: '/marine-licence/submit',
    ...submitMarineLicenceController
  }
]
