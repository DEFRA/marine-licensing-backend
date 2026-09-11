import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const REDACTABLE_FIELDS = ['preferredDates']

export const redactText = joi
  .object({
    fieldKey: joi
      .string()
      .valid(...REDACTABLE_FIELDS)
      .required()
      .messages({
        'string.empty': 'REDACTION_FIELD_KEY_REQUIRED',
        'any.only': 'REDACTION_FIELD_KEY_INVALID',
        'any.required': 'REDACTION_FIELD_KEY_REQUIRED'
      }),
    text: joi.string().trim().required().messages({
      'string.empty': 'REDACTION_TEXT_REQUIRED',
      'any.required': 'REDACTION_TEXT_REQUIRED'
    })
  })
  .append(marineLicenceId)
