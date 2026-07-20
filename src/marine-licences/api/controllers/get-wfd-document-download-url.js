import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { WFD_PRESIGNED_URL_EXPIRES_IN_SECONDS } from '../../constants/water-framework-directive.js'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

export const getWfdDocumentDownloadUrlController = {
  options: {
    auth: false,
    validate: {
      params: getMarineLicence
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
