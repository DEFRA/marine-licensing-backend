import joi from 'joi'
import { marineLicenceId } from './shared-models.js'
import { PUBLIC_REGISTER_WITHHOLD_REASON } from '../constants/marine-licence.js'

export const publicRegister = joi
  .object({
    withholdConsent: joi.string().valid('yes', 'no').required().messages({
      'string.empty': 'PUBLIC_REGISTER_WITHHOLD_CONSENT_REQUIRED',
      'any.only': 'PUBLIC_REGISTER_WITHHOLD_CONSENT_REQUIRED',
      'any.required': 'PUBLIC_REGISTER_WITHHOLD_CONSENT_REQUIRED'
    }),
    withholdReason: joi.when('withholdConsent', {
      is: 'yes',
      then: joi
        .string()
        .valid(...Object.values(PUBLIC_REGISTER_WITHHOLD_REASON))
        .required()
        .messages({
          'string.empty': 'PUBLIC_REGISTER_WITHHOLD_REASON_REQUIRED',
          'any.only': 'PUBLIC_REGISTER_WITHHOLD_REASON_REQUIRED',
          'any.required': 'PUBLIC_REGISTER_WITHHOLD_REASON_REQUIRED'
        }),
      otherwise: joi.forbidden()
    })
  })
  .append(marineLicenceId)
