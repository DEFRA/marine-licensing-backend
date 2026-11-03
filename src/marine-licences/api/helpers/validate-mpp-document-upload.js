import { config } from '../../../config.js'
import Boom from '@hapi/boom'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import { createLogger } from '../../../shared/common/helpers/logging/logger.js'
import {
  MPP_DOCUMENT_CONTENT_TYPES,
  MPP_DOCUMENT_MAX_FILE_SIZE
} from '../../constants/marine-plan-policy-document.js'

const logger = createLogger()
const logSystem = 'MarinePlanPolicy:Document Upload Validation'

export const validateMppDocumentUpload = async (marineLicence) => {
  const { s3Bucket, s3Key } = marineLicence.s3Location

  const allowedBucket = config.get('cdp.uploadBucket')
  if (s3Bucket !== allowedBucket) {
    logger.warn(`${logSystem}: S3 bucket validation failed`)

    throw Boom.forbidden('Invalid S3 bucket')
  }

  const metadata = await blobService.validateFileSize(
    s3Bucket,
    s3Key,
    MPP_DOCUMENT_MAX_FILE_SIZE
  )

  if (!MPP_DOCUMENT_CONTENT_TYPES.has(metadata.contentType)) {
    logger.warn(`${logSystem}: File type validation failed`)

    throw Boom.unsupportedMediaType(
      'File must be a PDF or document (.doc, .docx, .odt)'
    )
  }

  logger.info(
    `${logSystem}: Successfully validated marine plan policy document upload`
  )
}
