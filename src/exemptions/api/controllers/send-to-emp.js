import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { sendToEmp } from '../../models/send-to-emp.js'
import { ExemptionService } from '../services/exemption.service.js'
import { config } from '../../../config.js'
import { addToEmpQueue } from '../../../shared/common/helpers/emp/emp-processor.js'

export const sendToEmpController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    validate: {
      payload: sendToEmp
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, logger } = request
      const { id } = payload
      const { isEmpEnabled } = config.get('exploreMarinePlanning')

      if (!isEmpEnabled) {
        throw Boom.badRequest('EMP integration is not enabled')
      }

      const exemptionService = new ExemptionService({ db, logger })
      const exemption = await exemptionService.getExemptionById({ id })

      if (!exemption.applicationReference) {
        throw Boom.badRequest('Exemption has not been submitted')
      }

      const {
        applicationReference,
        createdAt,
        createdBy,
        updatedAt,
        updatedBy
      } = exemption

      await addToEmpQueue({
        db,
        fields: {
          applicationReference,
          createdAt,
          createdBy,
          updatedAt,
          updatedBy
        },
        server: request.server
      })

      return h
        .response({
          message: 'success',
          value: {
            applicationReference,
            message: 'Exemption added to EMP queue'
          }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.badImplementation('Failed to send exemption to EMP', error)
    }
  }
}
