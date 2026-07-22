import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { filterCurrentPolicyResponses } from '../helpers/marine-plan-policies/filter-current-policy-responses.js'
import {
  createTaskList,
  getSiteDetailsDataStatus
} from '../helpers/createTaskList.js'
import { COMPLETED } from '../../../shared/helpers/task-list-utils.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { getOrganisationDetailsFromAuthToken } from '../../../shared/helpers/get-organisation-from-token.js'
import { getAuthUserContext } from '../../../shared/helpers/get-auth-user-context.js'

export const getMarineLicenceController = ({ requiresAuth }) => ({
  options: {
    validate: {
      params: getMarineLicence
    },
    ...(requiresAuth ? {} : { auth: false })
  },
  handler: async (request, h) => {
    try {
      const {
        params: { id },
        db,
        logger,
        auth
      } = request
      const marineLicenceService = new MarineLicenceService({ db, logger })
      let marineLicence

      if (requiresAuth) {
        const { currentUserId } = getAuthUserContext(request)
        marineLicence = await marineLicenceService.getMarineLicenceById({
          id,
          currentUserId
        })
      } else {
        marineLicence =
          await marineLicenceService.getPublicMarineLicenceById(id)
      }

      const { userRelationshipType } = getOrganisationDetailsFromAuthToken(auth)

      const isCitizen = userRelationshipType === 'Citizen'

      const { _id, ...rest } = marineLicence
      const {
        responses: marinePlanPolicyResponses,
        count: marinePlanPolicyResponseCount
      } = filterCurrentPolicyResponses(
        rest.marinePlanPolicies,
        rest.marinePlanPolicyResponses
      )
      const taskList = createTaskList(marineLicence, isCitizen, {
        marinePlanPolicyResponseCount
      })
      const response = {
        id: _id.toString(),
        ...rest,
        marinePlanPolicyJob: rest.marinePlanPolicyJob ?? null,
        marinePlanPolicies: rest.marinePlanPolicies ?? [],
        marinePlanPolicyResponses,
        marinePlanPolicyResponseCount,
        taskList,
        siteDetailsDataComplete:
          getSiteDetailsDataStatus(marineLicence.siteDetails) === COMPLETED
      }

      return h
        .response({ message: 'success', value: response })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error retrieving marine licence: ${error.message}`)
    }
  }
})
