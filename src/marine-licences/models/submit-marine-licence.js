import joi from 'joi'

export const submitMarineLicence = joi.object({
  id: joi.string().length(24).hex().required().messages({
    'string.empty': 'MARINE_LICENCE_ID_REQUIRED',
    'string.length': 'MARINE_LICENCE_ID_REQUIRED',
    'string.hex': 'MARINE_LICENCE_ID_INVALID',
    'any.required': 'MARINE_LICENCE_ID_REQUIRED'
  }),
  userEmail: joi.string().email().required().messages({
    'string.empty': 'USER_EMAIL_REQUIRED',
    'string.email': 'USER_EMAIL_INVALID',
    'any.required': 'USER_EMAIL_REQUIRED'
  }),
  userName: joi.string().required().messages({
    'string.empty': 'USER_NAME_REQUIRED',
    'any.required': 'USER_NAME_REQUIRED'
  })
})
