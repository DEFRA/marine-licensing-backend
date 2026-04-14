import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'
import { getMarineLicenceController } from './controllers/get-marine-licence.js'
import { deleteMarineLicenceController } from './controllers/delete-marine-licence.js'
import { submitMarineLicenceController } from './controllers/submit-marine-licence.js'
import { updateSpecialLegalPowersController } from './controllers/update-special-legal-powers.js'
import { updatePublicRegisterController } from './controllers/update-public-register.js'
import { updateOtherAuthoritiesController } from './controllers/update-other-authorities.js'
import { updateProjectBackgroundController } from './controllers/update-project-background.js'
import { updateSiteDetailsController } from './controllers/update-site-details.js'

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
  },
  {
    method: 'PATCH',
    path: '/marine-licence/site-details',
    ...updateSiteDetailsController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/special-legal-powers',
    ...updateSpecialLegalPowersController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/other-authorities',
    ...updateOtherAuthoritiesController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/project-background',
    ...updateProjectBackgroundController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/public-register',
    ...updatePublicRegisterController
  }
]
