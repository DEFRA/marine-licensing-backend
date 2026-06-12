import joi from 'joi'

export const uploadedFileFieldSchema = joi
  .object({
    filename: joi.string().required().messages({
      'any.required': 'UPLOADED_FILE_FILENAME_REQUIRED',
      'string.empty': 'UPLOADED_FILE_FILENAME_REQUIRED'
    })
  })
  .required()
  .messages({
    'any.required': 'UPLOADED_FILE_REQUIRED',
    'object.base': 'UPLOADED_FILE_INVALID'
  })

export const s3LocationFieldSchema = joi
  .object({
    s3Bucket: joi.string().required().messages({
      'any.required': 'S3_BUCKET_REQUIRED',
      'string.empty': 'S3_BUCKET_REQUIRED'
    }),
    s3Key: joi.string().required().messages({
      'any.required': 'S3_KEY_REQUIRED',
      'string.empty': 'S3_KEY_REQUIRED'
    }),
    checksumSha256: joi.string().required().messages({
      'any.required': 'CHECKSUM_REQUIRED',
      'string.empty': 'CHECKSUM_REQUIRED'
    })
  })
  .required()
  .messages({
    'any.required': 'S3_LOCATION_REQUIRED',
    'object.base': 'S3_LOCATION_INVALID'
  })

export const fileUploadValidationSchema = {
  uploadedFile: joi.when('nauticalMile', {
    is: 'yes',
    then: uploadedFileFieldSchema,
    otherwise: joi.forbidden().messages({
      'any.unknown': 'WATER_FRAMEWORK_DIRECTIVE_INVALID'
    })
  }),
  s3Location: joi.when('nauticalMile', {
    is: 'yes',
    then: s3LocationFieldSchema,
    otherwise: joi.forbidden().messages({
      'any.unknown': 'WATER_FRAMEWORK_DIRECTIVE_INVALID'
    })
  })
}
