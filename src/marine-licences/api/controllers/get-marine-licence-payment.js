import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { config } from '../../../config.js'
import { paymentReturnParams } from '../../models/payment.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import {
  findPaymentByReturnId,
  resolvePayment
} from '../services/payment.service.js'

export const getMarineLicencePaymentController = {
  options: {
    validate: {
      params: paymentReturnParams
    }
  },
  handler: async (request, h) => {
    if (!config.get('govPay').isEnabled) {
      throw Boom.notFound()
    }

    const { params, db, locker, auth, logger } = request
    const payment = await findPaymentByReturnId(db, params.returnId)

    if (!payment) {
      throw Boom.notFound('Payment not found')
    }
    if (payment.contactId !== getContactId(auth)) {
      throw Boom.forbidden('Not authorised to request this resource')
    }

    const result = await resolvePayment({ db, locker, logger, payment })

    if (result.code) {
      logger.info(
        {
          event: {
            action: 'marine_licence_payment_not_completed',
            outcome: 'failure'
          }
        },
        `Payment ${payment.paymentId} for marine licence ${payment.applicationId} ended ${result.status} (${result.code})`
      )
    }

    return h
      .response({ message: 'success', value: result })
      .code(StatusCodes.OK)
  }
}
