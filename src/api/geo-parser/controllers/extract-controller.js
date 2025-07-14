import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { geoParserExtract } from '../../../models/geo-parser-extract.js'
import { geoParser } from '../../../services/geo-parser/geo-parser.js'
import { config } from '../../../config.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()

export const extractController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    validate: {
      payload: geoParserExtract
    }
  },
  handler: async (request, h) => {
    const { s3Bucket, s3Key, fileType } = request.payload

    logger.info(
      { s3Bucket, s3Key, fileType },
      'Processing geo-parser extract request'
    )

    try {
      // Validate S3 bucket against config
      const allowedBucket = config.get('cdp.uploadBucket')
      if (s3Bucket !== allowedBucket) {
        logger.warn(
          {
            s3Bucket,
            allowedBucket
          },
          'S3 bucket validation failed'
        )

        throw Boom.forbidden('Invalid S3 bucket')
      }

      // Extract GeoJSON from the file
      const geoJSON = await geoParser.extract(s3Bucket, s3Key, fileType)

      logger.info(
        {
          s3Bucket,
          s3Key,
          fileType,
          featureCount: geoJSON.features?.length || 0
        },
        'Successfully processed geo-parser extract request'
      )

      return h
        .response({
          message: 'success',
          value: geoJSON
        })
        .code(StatusCodes.OK)
    } catch (error) {
      logger.error(
        {
          s3Bucket,
          s3Key,
          fileType,
          error: error.message
        },
        'Failed to process geo-parser extract request'
      )

      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(`Extract processing failed: ${error.message}`)
    }
  }
}
