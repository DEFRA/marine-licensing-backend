import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const CONSULTATION_RESPONSE_MAX_LENGTH = 1000

export const updateConsultationRequestSchema = joi
  .object({
    response: joi
      .string()
      .trim()
      .required()
      .max(CONSULTATION_RESPONSE_MAX_LENGTH)
      .messages({
        'string.empty': 'CONSULTATION_RESPONSE_REQUIRED',
        'string.base': 'CONSULTATION_RESPONSE_REQUIRED',
        'string.max': 'CONSULTATION_RESPONSE_MAX_LENGTH',
        'any.required': 'CONSULTATION_RESPONSE_REQUIRED'
      })
  })
  .append(marineLicenceId)
