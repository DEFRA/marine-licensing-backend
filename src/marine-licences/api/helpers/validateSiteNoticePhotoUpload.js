import { config } from '../../../config.js'
import Boom from '@hapi/boom'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

const MAX_SIZE_10MB = 10 * 1024 * 1024

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png'])

const logSystem = 'SiteNoticePhoto:Upload Validation'

export const validateSiteNoticePhotoUpload = async (s3Location, logger) => {
  const { s3Bucket, s3Key } = s3Location

  const allowedBucket = config.get('cdp.uploadBucket')
  if (s3Bucket !== allowedBucket) {
    logger.warn(
      {
        event: {
          action: `${logSystem}:bucket-validation`,
          outcome: 'failure'
        }
      },
      'S3 bucket validation failed'
    )

    throw Boom.forbidden('Invalid S3 bucket')
  }

  const metadata = await blobService.getMetadata(s3Bucket, s3Key)

  if (metadata.size > MAX_SIZE_10MB) {
    logger.warn(
      {
        event: {
          action: `${logSystem}:size-validation`,
          outcome: 'failure'
        },
        fileSize: metadata.size,
        maxSize: MAX_SIZE_10MB
      },
      'File size validation failed'
    )

    throw Boom.entityTooLarge(
      `File size (${metadata.size} bytes) exceeds maximum allowed size (${MAX_SIZE_10MB} bytes)`
    )
  }

  if (!ALLOWED_CONTENT_TYPES.has(metadata.contentType)) {
    logger.warn(
      {
        event: {
          action: `${logSystem}:type-validation`,
          outcome: 'failure'
        },
        contentType: metadata.contentType
      },
      'File type validation failed'
    )

    throw Boom.unsupportedMediaType('File must be a JPG or PNG image')
  }
}
