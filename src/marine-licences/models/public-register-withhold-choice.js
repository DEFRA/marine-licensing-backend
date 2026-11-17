import joi from 'joi'

export const PUBLIC_REGISTER_REASON_MAX_LENGTH = 1000

export const withholdChoice = (withholdReason) => ({
  withholdConsent: joi.string().valid('yes').required(),
  withholdReason: joi.string().valid(withholdReason).required()
})
