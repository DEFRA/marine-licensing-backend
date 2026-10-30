import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { structureErrorForECS } from '../../../common/helpers/logging/logger.js'
import { cleanupTestData } from '../cleanup-test-data.js'

export const cleanupTestDataController = {
  options: {
    auth: false
  },
  handler: async (request, h) => {
    try {
      const value = await cleanupTestData(request.db)

      return h
        .response({
          message: 'success',
          value
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      request.logger.error(
        structureErrorForECS(error),
        'Failed to clean up journey test data'
      )
      throw Boom.internal(
        `Error cleaning up journey test data: ${error.message}`
      )
    }
  }
}
