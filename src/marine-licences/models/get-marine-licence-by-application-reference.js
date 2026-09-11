import joi from 'joi'

const APPLICATION_REFERENCE_URL_PARAMS = /^MLA-\d{4}-\d{5}$/

export const getMarineLicenceByApplicationReference = joi.object({
  applicationReference: joi
    .string()
    .pattern(APPLICATION_REFERENCE_URL_PARAMS)
    .required()
    .messages({
      'string.empty': 'APPLICATION_REFERENCE_REQUIRED',
      'string.pattern.base': 'APPLICATION_REFERENCE_INVALID',
      'any.required': 'APPLICATION_REFERENCE_REQUIRED'
    })
})
