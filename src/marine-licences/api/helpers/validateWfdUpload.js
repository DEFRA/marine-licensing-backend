import { config } from '../../../config.js'
import Boom from '@hapi/boom'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import { createLogger } from '../../../shared/common/helpers/logging/logger.js'

const logger = createLogger()
const logSystem = 'WaterFrameworkDirective:Update Controller'

const ALLOWED_CONTENT_TYPES = [
  'application/vnd.oasis.opendocument.text',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

export const validateWfdUpload = async (waterFrameworkDirective) => {
  const { s3Location } = waterFrameworkDirective

  // Validate S3 bucket against config
  const allowedBucket = config.get('cdp.uploadBucket')
  if (s3Location.s3Bucket !== allowedBucket) {
    logger.warn(`${logSystem}: S3 bucket validation failed`)

    throw Boom.forbidden('Invalid S3 bucket')
  }

  // Validate file size
  const { s3Bucket, s3Key } = s3Location

  const metadata = await blobService.validateFileSize(s3Bucket, s3Key)

  // Validate file type
  if (!ALLOWED_CONTENT_TYPES.includes(metadata.contentType)) {
    logger.warn(`${logSystem}: File type validation failed`)

    throw Boom.unsupportedMediaType('File must be an ODT or DOCX document')
  }

  logger.info(
    `${logSystem}: Successfully validated Water Framework Directive file upload`
  )
}
