import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { isApplicantUser } from '../helpers/is-applicant-user.js'

export const getExemptionSummaryController = {
  handler: async (request, h) => {
    try {
      if (isApplicantUser(request)) {
        throw Boom.forbidden('Not authorised to request this resource')
      }

      const { db } = request
      const groupedStatusCounts = await db
        .collection(collectionExemptions)
        .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
        .toArray()

      const countsByStatus = groupedStatusCounts.reduce((acc, item) => {
        acc[item._id] = item.count
        return acc
      }, {})

      const submittedExemptions =
        (countsByStatus[EXEMPTION_STATUS.ACTIVE] ?? 0) +
        (countsByStatus[EXEMPTION_STATUS.SUBMITTED] ?? 0)

      return h
        .response({
          message: 'success',
          value: {
            submittedExemptions,
            unsubmittedExemptions: countsByStatus[EXEMPTION_STATUS.DRAFT] ?? 0,
            withdrawnExemptions: countsByStatus[EXEMPTION_STATUS.WITHDRAWN] ?? 0
          }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(
        `Error retrieving exemption summary: ${error.message}`
      )
    }
  }
}
