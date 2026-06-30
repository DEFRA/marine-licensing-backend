import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const feeEstimateSchema = joi
  .object({
    accept: joi.string().valid('yes', 'no').required().messages({
      'string.empty': 'FEE_ESTIMATE_ACCEPT_REQUIRED',
      'any.only': 'FEE_ESTIMATE_ACCEPT_REQUIRED',
      'any.required': 'FEE_ESTIMATE_ACCEPT_REQUIRED'
    }),
    termsAndConditions: joi.boolean().valid(true).required().messages({
      'any.only': 'FEE_ESTIMATE_TERMS_AND_CONDITIONS_REQUIRED',
      'any.required': 'FEE_ESTIMATE_TERMS_AND_CONDITIONS_REQUIRED'
    })
  })
  .append(marineLicenceId)
