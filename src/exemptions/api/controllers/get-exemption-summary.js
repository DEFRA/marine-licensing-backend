import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'

export const getExemptionSummaryController = {
  handler: async (request, h) => {
    try {
      const { db } = request
      const groupedStatusCounts = await db
        .collection(collectionExemptions)
        .aggregate([
          {
            $match: {
              status: {
                $in: [
                  EXEMPTION_STATUS.ACTIVE,
                  EXEMPTION_STATUS.SUBMITTED,
                  EXEMPTION_STATUS.DRAFT,
                  EXEMPTION_STATUS.WITHDRAWN
                ]
              }
            }
          },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
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
      request.logger.error(
        structureErrorForECS(error),
        'Failed to retrieve exemption summary'
      )
      throw Boom.internal(
        `Error retrieving exemption summary: ${error.message}`
      )
    }
  }
}
