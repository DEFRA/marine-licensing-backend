import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import {
  buildExemptionSummaryPipeline,
  buildExemptionSummaryValue,
  EMPTY_EXEMPTION_SUMMARY_FACET
} from '../helpers/exemption-summary.js'

export const getExemptionSummaryController = {
  handler: async (request, h) => {
    try {
      const { db } = request
      const [summaryResult] = await db
        .collection(collectionExemptions)
        .aggregate(buildExemptionSummaryPipeline())
        .toArray()

      return h
        .response({
          message: 'success',
          value: buildExemptionSummaryValue(
            summaryResult ?? EMPTY_EXEMPTION_SUMMARY_FACET
          )
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
