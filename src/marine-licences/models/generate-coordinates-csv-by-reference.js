import joi from 'joi'

const applicationReferencePattern = /^MLA\/\d{4}\/\d{5}$/

export const generateCoordinatesCsvByReferenceParams = joi.object({
  applicationReference: joi
    .string()
    .required()
    .custom((value, helpers) => {
      const decoded = decodeURIComponent(value)
      if (!applicationReferencePattern.test(decoded)) {
        return helpers.error('any.invalid')
      }
      return decoded
    })
    .messages({
      'any.invalid': 'APPLICATION_REFERENCE_INVALID',
      'any.required': 'APPLICATION_REFERENCE_REQUIRED',
      'string.empty': 'APPLICATION_REFERENCE_REQUIRED'
    })
})
