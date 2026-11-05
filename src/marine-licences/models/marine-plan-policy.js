import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const POLICY_CODE_MAX_LENGTH = 100
export const POLICY_CONSIDERATION_MIN_LENGTH = 70
export const POLICY_CONSIDERATION_MAX_LENGTH = 5000

export const calculateMarinePlanPoliciesSchema = joi
  .object()
  .append(marineLicenceId)

export const marinePlanPolicyResponseSchema = joi
  .object({
    policyCode: joi.string().max(POLICY_CODE_MAX_LENGTH).required().messages({
      'string.empty': 'POLICY_CODE_REQUIRED',
      'string.max': 'POLICY_CODE_INVALID',
      'any.required': 'POLICY_CODE_REQUIRED'
    }),
    response: joi
      .string()
      .allow('')
      .min(POLICY_CONSIDERATION_MIN_LENGTH)
      .max(POLICY_CONSIDERATION_MAX_LENGTH)
      .required()
      .messages({
        'string.min': 'POLICY_CONSIDERATION_MIN_LENGTH',
        'string.max': 'POLICY_CONSIDERATION_MAX_LENGTH',
        'any.required': 'POLICY_RESPONSE_REQUIRED'
      }),
    requiresDocumentation: joi.boolean().default(false).messages({
      'boolean.base': 'REQUIRES_DOCUMENTATION_INVALID'
    })
  })
  .append(marineLicenceId)
