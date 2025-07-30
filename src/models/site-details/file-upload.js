import joi from 'joi'

export const fileUploadTypeFieldSchema = joi
  .string()
  .valid('kml', 'shapefile')
  .required()
  .messages({
    'any.only': 'FILE_UPLOAD_TYPE_REQUIRED',
    'string.empty': 'FILE_UPLOAD_TYPE_REQUIRED',
    'any.required': 'FILE_UPLOAD_TYPE_REQUIRED'
  })

export const geoJSONFieldSchema = joi
  .object({
    type: joi.string().valid('FeatureCollection').required(),
    features: joi
      .array()
      .items(
        joi
          .object({
            type: joi.string().valid('Feature').required(),
            geometry: joi
              .object({
                type: joi.string().required(),
                coordinates: joi.array().required()
              })
              .required(),
            properties: joi.object().default({})
          })
          .required()
      )
      .required()
  })
  .required()
  .messages({
    'any.required': 'GEO_JSON_REQUIRED',
    'object.base': 'GEO_JSON_INVALID'
  })

export const featureCountFieldSchema = joi
  .number()
  .integer()
  .min(0)
  .required()
  .messages({
    'any.required': 'FEATURE_COUNT_REQUIRED',
    'number.base': 'FEATURE_COUNT_INVALID',
    'number.integer': 'FEATURE_COUNT_INVALID',
    'number.min': 'FEATURE_COUNT_INVALID'
  })

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

export const fileUploadValidationSchema = joi.object({
  coordinatesType: joi.string().valid('file').required(),
  fileUploadType: fileUploadTypeFieldSchema,
  geoJSON: geoJSONFieldSchema,
  featureCount: featureCountFieldSchema,
  uploadedFile: uploadedFileFieldSchema,
  s3Location: s3LocationFieldSchema
})
