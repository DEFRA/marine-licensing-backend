import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ExemptionService } from '../services/exemption.service.js'
import { exemptionIdOnly } from '../../models/shared-models.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { updateCoastalOperationsAreas } from '../../../shared/common/helpers/geo/update-coastal-operations-areas.js'
import { updateMarinePlanningAreas } from '../../../shared/common/helpers/geo/update-marine-planning-areas.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/index.js'
import { DYNAMICS_REQUEST_ACTIONS } from '../../../shared/common/constants/request-queue.js'
import { config } from '../../../config.js'

export const backfillAreasController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    validate: {
      payload: exemptionIdOnly
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, logger } = request
      const { id, updatedAt, updatedBy } = payload
      const { isDynamicsEnabled } = config.get('dynamics')

      const exemptionService = new ExemptionService({ db, logger })
      const exemption = await exemptionService.getExemptionById({ id })

      if (exemption.status !== EXEMPTION_STATUS.ACTIVE) {
        throw Boom.badRequest(`Exemption is not in ${EXEMPTION_STATUS.ACTIVE}`)
      }

      if (!exemption.marinePlanAreas && !exemption.coastalOperationsAreas) {
        throw Boom.badRequest('Exemption already has correct data')
      }

      const { applicationReference } = exemption

      await updateCoastalOperationsAreas(exemption, db, {
        updatedAt,
        updatedBy
      })

      await updateMarinePlanningAreas(exemption, db, {
        updatedAt,
        updatedBy
      })

      await db
        .collection(collectionExemptions)
        .updateOne(
          { _id: exemption._id },
          { $set: { areaBackfillCompleteAt: new Date().toISOString() } }
        )

      if (isDynamicsEnabled) {
        await addToDynamicsQueue({
          request,
          applicationReference,
          action: DYNAMICS_REQUEST_ACTIONS.UPDATE
        })
      }

      return h
        .response({
          message: 'success',
          value: {
            applicationReference,
            message: 'Backfill for Exemption is successful'
          }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.badImplementation('Failed to backfill exemption', error)
    }
  }
}
