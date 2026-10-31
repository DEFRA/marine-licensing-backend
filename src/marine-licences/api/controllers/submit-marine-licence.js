import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { submitMarineLicence } from '../../models/submit-marine-licence.js'
import { checkForIncompleteTasks } from '../helpers/check-for-incomplete-tasks.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { submitMarineLicenceApplication } from '../services/submit-marine-licence-application.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { getOrganisationDetailsFromAuthToken } from '../../../shared/helpers/get-organisation-from-token.js'

const getMarineLicenceFromDb = async (request, marineLicenceId) => {
  const { auth, db, logger } = request
  const currentUserId = getContactId(auth)
  const marineLicenceService = new MarineLicenceService({ db, logger })
  const marineLicence = await marineLicenceService.getMarineLicenceById({
    id: marineLicenceId,
    currentUserId
  })

  if (marineLicence.applicationReference) {
    throw Boom.conflict('Marine licence has already been submitted')
  }

  return marineLicence
}

export const submitMarineLicenceController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      payload: submitMarineLicence
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, locker, auth, logger } = request
      const { id, userName, userEmail, updatedAt, updatedBy } = payload

      const { userRelationshipType } = getOrganisationDetailsFromAuthToken(auth)

      const isCitizen = userRelationshipType === 'Citizen'

      const marineLicence = await getMarineLicenceFromDb(request, id)

      checkForIncompleteTasks(marineLicence, isCitizen)

      const { applicationReference, submittedAt } =
        await submitMarineLicenceApplication({
          db,
          locker,
          logger,
          id,
          marineLicence,
          userName,
          userEmail,
          updatedAt,
          updatedBy
        })

      return h
        .response({
          message: 'success',
          value: {
            applicationReference,
            submittedAt: submittedAt.toISOString()
          }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error submitting marine licence: ${error.message}`)
    }
  }
}
