import { getExemptionController } from './controllers/get-exemption.js'
import { createProjectNameController } from './controllers/create-project-name.js'

export const exemptions = [
  {
    method: 'GET',
    path: '/exemption/{id}',
    ...getExemptionController
  },
  {
    method: 'POST',
    path: '/exemption/project-name',
    ...createProjectNameController
  }
]
