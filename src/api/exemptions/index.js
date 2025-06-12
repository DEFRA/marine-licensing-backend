import { getExemptionController } from './controllers/get-exemption.js'
import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'
import { updatePublicRegisterController } from './controllers/update-public-register.js'
import { createActivityDescriptionController } from './controllers/create-activity-description.js'
import { updateSiteDetailsController } from './controllers/update-site-details.js'

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
  },
  {
    method: 'PATCH',
    path: '/exemption/project-name',
    ...updateProjectNameController
  },
  {
    method: 'PATCH',
    path: '/exemption/public-register',
    ...updatePublicRegisterController
  },
  {
    method: 'PATCH',
    path: '/exemption/site-details',
    ...updateSiteDetailsController
  },
  {
    method: 'PATCH',
    path: '/exemption/activity-description',
    ...createActivityDescriptionController
  }
]
