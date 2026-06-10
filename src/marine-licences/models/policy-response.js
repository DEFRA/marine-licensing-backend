import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const maxResponseLength = 5000

export const policyResponseSchema = joi
  .object({
    policyCode: joi.string().max(100).required().messages({
      'string.empty': 'POLICY_CODE_REQUIRED',
      'string.max': 'POLICY_CODE_INVALID',
      'any.required': 'POLICY_CODE_REQUIRED'
    }),
    response: joi
      .string()
      .allow('')
      .max(maxResponseLength)
      .required()
      .messages({
        'string.max': 'POLICY_RESPONSE_MAX_LENGTH',
        'any.required': 'POLICY_RESPONSE_REQUIRED'
      })
  })
  .append(marineLicenceId)
