import joi from 'joi'

export const geoParserExtract = joi.object({
  s3Bucket: joi.string().required().messages({
    'string.empty': 'S3_BUCKET_REQUIRED',
    'any.required': 'S3_BUCKET_REQUIRED'
  }),
  s3Key: joi
    .string()
    .required()
    .min(1)
    .max(1024)
    .pattern(/^[a-zA-Z0-9._/-]+$/)
    .custom((value, helpers) => {
      // Check for path traversal attempts
      if (value.includes('../') || value.includes('..\\')) {
        return helpers.error('string.pathTraversal')
      }
      return value
    })
    .messages({
      'string.empty': 'S3_KEY_REQUIRED',
      'string.min': 'S3_KEY_REQUIRED',
      'string.max': 'S3_KEY_INVALID',
      'string.pattern.base': 'S3_KEY_INVALID',
      'string.pathTraversal': 'S3_KEY_INVALID',
      'any.required': 'S3_KEY_REQUIRED'
    }),
  fileType: joi
    .string()
    .required()
    .custom((value, helpers) => {
      const normalizedValue = value.toLowerCase()
      if (!['kml', 'shapefile'].includes(normalizedValue)) {
        return helpers.error('string.fileType')
      }
      return normalizedValue
    })
    .messages({
      'string.empty': 'FILE_TYPE_REQUIRED',
      'string.fileType': 'FILE_TYPE_INVALID',
      'any.required': 'FILE_TYPE_REQUIRED'
    })
})
