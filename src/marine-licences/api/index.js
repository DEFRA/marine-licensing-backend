import { createProjectNameController } from './controllers/create-project-name.js'
import { updateProjectNameController } from './controllers/update-project-name.js'
import { getMarineLicenceController } from './controllers/get-marine-licence.js'
import { deleteMarineLicenceController } from './controllers/delete-marine-licence.js'
import { submitMarineLicenceController } from './controllers/submit-marine-licence.js'
import { updateSpecialLegalPowersController } from './controllers/update-special-legal-powers.js'
import { updatePublicRegisterController } from './controllers/update-public-register.js'
import { updatePreferredDatesController } from './controllers/update-preferred-dates.js'
import { updatePublicConsultationController } from './controllers/update-public-consultation.js'
import { updateOtherAuthoritiesController } from './controllers/update-other-authorities.js'
import { updateProjectBackgroundController } from './controllers/update-project-background.js'
import { updateSiteDetailsController } from './controllers/update-site-details.js'
import { addActivityDetailsController } from './controllers/add-activity-details.js'
import { deleteActivityDetailsController } from './controllers/delete-activity-details.js'
import { updateSiteController } from './controllers/update-site.js'
import { generateCoordinatesCsvController } from './controllers/generate-coordinates-csv.js'
import { updateWaterFrameworkDirectiveController } from './controllers/update-water-framework-directive.js'
import { updateFeeEstimateController } from './controllers/update-fee-estimate.js'
import { updateHarbourAuthorityController } from './controllers/update-harbour-authority.js'
import { calculateMarinePlanPoliciesController } from './controllers/calculate-marine-plan-policies.js'
import { saveMarinePlanPolicyResponseController } from './controllers/save-marine-plan-policy-response.js'
import { updateInvoicingController } from './controllers/update-invoicing.js'

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
    path: '/marine-licence/site',
    ...updateSiteController
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
    path: '/marine-licence/add-activity-details',
    ...addActivityDetailsController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/delete-activity-details',
    ...deleteActivityDetailsController
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
  },
  {
    method: 'PATCH',
    path: '/marine-licence/preferred-dates',
    ...updatePreferredDatesController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/public-consultation',
    ...updatePublicConsultationController
  },
  {
    method: 'GET',
    path: '/marine-licence/{id}/generate-coordinates-csv',
    ...generateCoordinatesCsvController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/water-framework-directive',
    ...updateWaterFrameworkDirectiveController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/fee-estimate',
    ...updateFeeEstimateController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/harbour-authority',
    ...updateHarbourAuthorityController
  },
  {
    method: 'POST',
    path: '/marine-licence/calculate-marine-plan-policies',
    ...calculateMarinePlanPoliciesController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/marine-plan-policy-response',
    ...saveMarinePlanPolicyResponseController
  },
  {
    method: 'PATCH',
    path: '/marine-licence/invoicing',
    ...updateInvoicingController
  }
]
