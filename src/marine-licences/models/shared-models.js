import joi from 'joi'

export const marineLicenseId = {
  id: joi.string().length(24).hex().required().messages({
    'string.empty': 'MARINE_LICENSE_ID_REQUIRED',
    'string.length': 'MARINE_LICENSE_ID_REQUIRED',
    'string.hex': 'MARINE_LICENSE_ID_INVALID',
    'any.required': 'MARINE_LICENSE_ID_REQUIRED'
  })
}
