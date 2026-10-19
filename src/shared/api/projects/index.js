import { getProjectsController } from './controllers/get-projects.js'
import { getUsersController } from './controllers/get-users.js'
import { getConsultationsController } from './controllers/get-consultations.js'

export const projects = [
  {
    method: 'POST',
    path: '/projects',
    ...getProjectsController
  },
  {
    method: 'POST',
    path: '/projects/users',
    ...getUsersController
  },
  {
    method: 'GET',
    path: '/projects/consultations',
    ...getConsultationsController
  }
]
