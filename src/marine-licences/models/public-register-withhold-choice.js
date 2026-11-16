import joi from 'joi'

export const withholdChoice = (withholdReason) => ({
  withholdConsent: joi.string().valid('yes').required(),
  withholdReason: joi.string().valid(withholdReason).required()
})
