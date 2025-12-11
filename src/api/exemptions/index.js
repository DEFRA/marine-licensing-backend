import { getExemptionController } from './controllers/get-exemption.js'
import { getExemptionsController } from './controllers/get-exemptions.js'
import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'
import { updatePublicRegisterController } from './controllers/update-public-register.js'
import { updateSiteDetailsController } from './controllers/update-site-details.js'
import { submitExemptionController } from './controllers/submit-exemption.js'
import { deleteExemptionController } from './controllers/delete-exemption.js'

export const exemptions = [
  {
    method: 'GET',
    path: '/exemption/{id}',
    ...getExemptionController({ requiresAuth: true })
  },
  {
    method: 'GET',
    path: '/public/exemption/{id}',
    ...getExemptionController({ requiresAuth: false })
  },
  {
    method: 'GET',
    path: '/exemptions',
    ...getExemptionsController
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
    method: 'POST',
    path: '/exemption/submit',
    ...submitExemptionController
  },
  {
    method: 'DELETE',
    path: '/exemption/{id}',
    ...deleteExemptionController
  }
]
