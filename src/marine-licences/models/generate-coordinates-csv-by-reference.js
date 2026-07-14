import joi from 'joi'

const applicationReferencePattern = /^MLA\/\d{4}\/\d{5}$/

const decodeApplicationReference = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const generateCoordinatesCsvByReferenceParams = joi.object({
  applicationReference: joi
    .string()
    .required()
    .custom(decodeApplicationReference)
    .pattern(applicationReferencePattern)
    .messages({
      'string.pattern.base': 'APPLICATION_REFERENCE_INVALID',
      'any.required': 'APPLICATION_REFERENCE_REQUIRED',
      'string.empty': 'APPLICATION_REFERENCE_REQUIRED'
    })
})
