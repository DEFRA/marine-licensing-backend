import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const PUBLIC_REGISTER_REASON_MAX_TEXT_LENGTH = 1000

// consent 'yes' means the applicant wants information withheld. The exemption
// journey's model uses the same field with the opposite meaning.
export const publicRegister = joi
  .object({
    consent: joi.string().valid('yes', 'no').required().messages({
      'string.empty': 'PUBLIC_REGISTER_CONSENT_REQUIRED',
      'any.only': 'PUBLIC_REGISTER_CONSENT_REQUIRED',
      'any.required': 'PUBLIC_REGISTER_CONSENT_REQUIRED'
    }),
    reason: joi.when('consent', {
      is: 'yes',
      then: joi
        .string()
        .trim()
        .required()
        .min(1)
        .max(PUBLIC_REGISTER_REASON_MAX_TEXT_LENGTH)
        .messages({
          'string.empty': 'PUBLIC_REGISTER_REASON_REQUIRED',
          'string.max': 'PUBLIC_REGISTER_REASON_MAX_LENGTH',
          'any.required': 'PUBLIC_REGISTER_REASON_REQUIRED'
        }),
      otherwise: joi.forbidden()
    })
  })
  .append(marineLicenceId)
