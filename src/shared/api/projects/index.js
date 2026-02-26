import { getProjectsController } from './controllers/get-projects.js'

export const projects = [
  {
    method: 'GET',
    path: '/projects',
    ...getProjectsController
  }
]
