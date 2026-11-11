import joi from 'joi'
import { marineLicenceId } from './shared-models.js'
import { withCharacterLimit } from '../../shared/models/character-limit.js'

export const PUBLIC_REGISTER_NATIONAL_SECURITY_REASON_MAX_LENGTH = 1000

export const publicRegisterNationalSecurity = joi
  .object({
    nationalSecurityApproval: joi
      .string()
      .valid('yes', 'no')
      .required()
      .messages({
        'string.empty': 'PUBLIC_REGISTER_NATIONAL_SECURITY_APPROVAL_REQUIRED',
        'any.only': 'PUBLIC_REGISTER_NATIONAL_SECURITY_APPROVAL_REQUIRED',
        'any.required': 'PUBLIC_REGISTER_NATIONAL_SECURITY_APPROVAL_REQUIRED'
      }),
    reason: joi.when('nationalSecurityApproval', {
      is: 'yes',
      then: withCharacterLimit(
        joi.string().trim(),
        PUBLIC_REGISTER_NATIONAL_SECURITY_REASON_MAX_LENGTH
      )
        .required()
        .messages({
          'string.empty': 'PUBLIC_REGISTER_NATIONAL_SECURITY_REASON_REQUIRED',
          'any.required': 'PUBLIC_REGISTER_NATIONAL_SECURITY_REASON_REQUIRED',
          'string.max': 'PUBLIC_REGISTER_NATIONAL_SECURITY_REASON_MAX_LENGTH'
        }),
      otherwise: joi.forbidden()
    })
  })
  .append(marineLicenceId)
