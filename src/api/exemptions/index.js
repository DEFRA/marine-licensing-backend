import { getExemptionController } from './controllers/get-exemption.js'
import { getExemptionsController } from './controllers/get-exemptions.js'
import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'
import { updatePublicRegisterController } from './controllers/update-public-register.js'
import { updateSiteDetailsController } from './controllers/update-site-details.js'
import { submitExemptionController } from './controllers/submit-exemption.js'
import { deleteExemptionController } from './controllers/delete-exemption.js'
import { getCoastalEnforcementAreaMongoController } from './controllers/get-coastal-enforcement-area-mongo.js'
import { getCoastalEnforcementAreaController } from './controllers/get-coastal-enforcement-area.js'

export const exemptions = [
  {
    method: 'GET',
    path: '/exemption/{id}',
    ...getExemptionController
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
  },
  {
    method: 'GET',
    path: '/exemption/coastal-enforcement-area-mongo/{id}',
    ...getCoastalEnforcementAreaMongoController
  },
  {
    method: 'GET',
    path: '/exemption/coastal-enforcement-area/{id}',
    ...getCoastalEnforcementAreaController
  }
]
