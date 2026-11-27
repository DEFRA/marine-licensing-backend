import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import {
  SITE_NOTICE_PHOTO_FIELD_BY_TYPE,
  SITE_NOTICE_PHOTO_PRESIGNED_URL_EXPIRES_IN_SECONDS
} from '../../constants/site-notice-evidence.js'
import { getSiteNoticePhotoDownloadUrl } from '../../models/get-site-notice-photo-download-url.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import { errorResponseSchema } from '../../../shared/models/error-response.js'
import { logResponseSchemaMismatch } from '../../../shared/common/helpers/log-response-schema-mismatch.js'
import { siteNoticePhotoDownloadUrlResponseSchema } from '../../models/gateway-responses.js'

export const getSiteNoticePhotoDownloadUrlController = {
  options: {
    auth: false,
    tags: ['api'],
    description:
      'Get a download URL for a marine licence site notice photograph',
    notes:
      'Returns a presigned S3 URL for a site notice photograph uploaded with any marine licence that is not a draft. locationNumber is 1-based. photoType is close-up or position. The URL expires after expiresIn seconds.',
    validate: {
      params: getSiteNoticePhotoDownloadUrl
    },
    response: {
      status: {
        200: siteNoticePhotoDownloadUrlResponseSchema,
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
          400: {
            description:
              'The id is not a 24-character hex string, locationNumber is invalid, or photoType is not close-up or position'
          },
          403: { description: 'The marine licence is a draft' },
          404: {
            description:
              'No marine licence has this id, or it has no site notice photograph for that location and type'
          },
          500: { description: 'Unexpected server error' }
        }
      }
    }
  },
  handler: async (request, h) => {
    const { id, locationNumber, photoType } = request.params

    const doc = await request.db
      .collection(collectionMarineLicences)
      .findOne(
        { _id: ObjectId.createFromHexString(id) },
        { projection: { siteNoticeEvidence: 1, status: 1 } }
      )

    if (!doc) {
      throw Boom.notFound('Marine licence not found')
    }

    if (doc.status === MARINE_LICENCE_STATUS.DRAFT) {
      throw Boom.forbidden(notAuthorisedMessage)
    }

    const evidence = doc.siteNoticeEvidence?.[locationNumber - 1]
    const photoField = SITE_NOTICE_PHOTO_FIELD_BY_TYPE[photoType]
    const s3Location = evidence?.[photoField]?.s3Location

    if (!s3Location?.s3Bucket || !s3Location?.s3Key) {
      throw Boom.notFound('Site notice photograph not found')
    }

    const url = await blobService.getPresignedUrl(
      s3Location.s3Bucket,
      s3Location.s3Key,
      SITE_NOTICE_PHOTO_PRESIGNED_URL_EXPIRES_IN_SECONDS
    )

    return h
      .response({
        message: 'success',
        value: {
          url,
          expiresIn: SITE_NOTICE_PHOTO_PRESIGNED_URL_EXPIRES_IN_SECONDS
        }
      })
      .code(StatusCodes.OK)
  }
}
