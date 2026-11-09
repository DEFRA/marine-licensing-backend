import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { config } from '../../../config.js'
import { submitMarineLicence } from '../../models/submit-marine-licence.js'
import { getSubmittableMarineLicence } from '../helpers/get-submittable-marine-licence.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
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

    const { payload, db, locker, auth } = request
    const { id, userName, userEmail } = payload

    await getSubmittableMarineLicence(request, id)

    const nextUrl = await createOrResumePayment({
      db,
      locker,
      applicationId: id,
      contactId: getContactId(auth),
      userName,
      userEmail
    })

    return h
      .response({ message: 'success', value: { nextUrl } })
      .code(StatusCodes.OK)
  }
}
