import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { WFD_PRESIGNED_URL_EXPIRES_IN_SECONDS } from '../../constants/water-framework-directive.js'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import { errorResponseSchema } from '../../../shared/models/error-response.js'
import { logResponseSchemaMismatch } from '../../../shared/common/helpers/log-response-schema-mismatch.js'
import { wfdDocumentDownloadUrlResponseSchema } from '../../models/gateway-responses.js'

export const getWfdDocumentDownloadUrlController = {
  options: {
    auth: false,
    tags: ['api'],
    description:
      'Get a download URL for a marine licence Water Framework Directive document',
    notes:
      'Returns a presigned S3 URL for the Water Framework Directive document uploaded with a submitted or withdrawn marine licence. The URL expires after expiresIn seconds.',
    validate: {
      params: getMarineLicence
    },
    response: {
      status: {
        200: wfdDocumentDownloadUrlResponseSchema,
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema
      },
      failAction: logResponseSchemaMismatch
    },
    plugins: {
      'hapi-swagger': {
        responses: {
          200: { description: 'A presigned download URL' },
          400: { description: 'The id is not a 24-character hex string' },
          403: { description: 'The marine licence is a draft' },
          404: {
            description:
              'No marine licence has this id, or it has no Water Framework Directive document'
          },
          500: { description: 'Unexpected server error' }
        }
      }
    }
  },
  handler: async (request, h) => {
    const { id } = request.params

    const doc = await request.db
      .collection(collectionMarineLicences)
      .findOne(
        { _id: ObjectId.createFromHexString(id) },
        { projection: { waterFrameworkDirective: 1, status: 1 } }
      )

    if (!doc) {
      throw Boom.notFound('Marine licence not found')
    }

    if (doc.status === MARINE_LICENCE_STATUS.DRAFT) {
      throw Boom.forbidden(notAuthorisedMessage)
    }

    const s3Location = doc.waterFrameworkDirective?.s3Location
    if (!s3Location?.s3Bucket || !s3Location?.s3Key) {
      throw Boom.notFound('Water Framework Directive document not found')
    }

    const url = await blobService.getPresignedUrl(
      s3Location.s3Bucket,
      s3Location.s3Key,
      WFD_PRESIGNED_URL_EXPIRES_IN_SECONDS
    )

    return h
      .response({
        message: 'success',
        value: {
          url,
          expiresIn: WFD_PRESIGNED_URL_EXPIRES_IN_SECONDS
        }
      })
      .code(StatusCodes.OK)
  }
}
