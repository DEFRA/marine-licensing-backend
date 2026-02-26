import joi from 'joi'

export const getMarineLicence = joi.object({
  id: joi.string().length(24).hex().required().messages({
    'string.empty': 'MARINE_LICENCE_ID_REQUIRED',
    'string.length': 'MARINE_LICENCE_ID_REQUIRED',
    'string.hex': 'MARINE_LICENCE_ID_INVALID',
    'any.required': 'MARINE_LICENCE_ID_REQUIRED'
  })
})
