import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { config } from '../../../config.js'
import { submitMarineLicence } from '../../models/submit-marine-licence.js'
import { checkForIncompleteTasks } from '../helpers/check-for-incomplete-tasks.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { getOrganisationDetailsFromAuthToken } from '../../../shared/helpers/get-organisation-from-token.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { createOrResumePayment } from '../services/payment.service.js'

export const createMarineLicencePaymentController = {
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
    if (!config.get('govPay').isEnabled) {
      throw Boom.notFound()
    }

    const { payload, db, locker, auth, logger } = request
    const { id, userName, userEmail } = payload
    const contactId = getContactId(auth)

    const marineLicence = await new MarineLicenceService({
      db,
      logger
    }).getMarineLicenceById({ id, currentUserId: contactId })

    if (marineLicence.applicationReference) {
      throw Boom.conflict('Marine licence has already been submitted')
    }

    const { userRelationshipType } = getOrganisationDetailsFromAuthToken(auth)
    checkForIncompleteTasks(marineLicence, userRelationshipType === 'Citizen')

    const nextUrl = await createOrResumePayment({
      db,
      locker,
      applicationId: id,
      contactId,
      userName,
      userEmail
    })

    return h
      .response({ message: 'success', value: { nextUrl } })
      .code(StatusCodes.OK)
  }
}
