import { getExemptionController } from './controllers/get-exemption.js'
import { getUnsentEmpExemptionsController } from './controllers/get-unsent-emp-exemptions.js'
import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'
import { updatePublicRegisterController } from './controllers/update-public-register.js'
import { updateSiteDetailsController } from './controllers/update-site-details.js'
import { submitExemptionController } from './controllers/submit-exemption.js'
import { deleteExemptionController } from './controllers/delete-exemption.js'
import { sendToEmpController } from './controllers/send-to-emp.js'
import { withdrawExemptionController } from './controllers/withdraw-exemption.js'

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
    path: '/exemptions/send-to-emp',
    ...getUnsentEmpExemptionsController
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
    method: 'POST',
    path: '/exemption/send-to-emp',
    ...sendToEmpController
  },
  {
    method: 'DELETE',
    path: '/exemption/{id}',
    ...deleteExemptionController
  },
  {
    method: 'POST',
    path: '/exemption/{id}/withdraw',
    ...withdrawExemptionController
  }
]
