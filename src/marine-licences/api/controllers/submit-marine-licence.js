import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { config } from '../../../config.js'
import { submitMarineLicence } from '../../models/submit-marine-licence.js'
import { getSubmittableMarineLicence } from '../helpers/get-submittable-marine-licence.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { submitMarineLicenceApplication } from '../services/submit-marine-licence-application.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

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
      // With GOV.UK Pay on, only a successful payment may submit, otherwise
      // this route bypasses the fee and races the paid submission
      if (config.get('govPay').isEnabled) {
        throw Boom.forbidden('Marine licence must be submitted through payment')
      }

      const { payload, db, locker, logger } = request
      const { id, userName, userEmail, updatedAt, updatedBy } = payload

      const marineLicence = await getSubmittableMarineLicence(request, id)

      const { applicationReference, submittedAt } =
        await submitMarineLicenceApplication({
          db,
          locker,
          logger,
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
