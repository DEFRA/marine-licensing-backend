import joi from 'joi'

export const sendToEmp = joi.object({
  id: joi.string().length(24).hex().required().messages({
    'string.empty': 'EXEMPTION_ID_REQUIRED',
    'string.length': 'EXEMPTION_ID_REQUIRED',
    'string.hex': 'EXEMPTION_ID_INVALID',
    'any.required': 'EXEMPTION_ID_REQUIRED'
  })
})
