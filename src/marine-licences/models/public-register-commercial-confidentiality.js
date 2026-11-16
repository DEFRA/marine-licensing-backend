import joi from 'joi'
import { marineLicenceId } from './shared-models.js'
import { withCharacterLimit } from '../../shared/models/character-limit.js'
import { PUBLIC_REGISTER_WITHHOLD_REASON } from '../constants/marine-licence.js'
import { withholdChoice } from './public-register-withhold-choice.js'

export const PUBLIC_REGISTER_COMMERCIAL_CONFIDENTIALITY_REASON_MAX_LENGTH = 1000

export const publicRegisterCommercialConfidentiality = joi
  .object({
    ...withholdChoice(
      PUBLIC_REGISTER_WITHHOLD_REASON.COMMERCIAL_CONFIDENTIALITY
    ),
    reason: withCharacterLimit(
      joi.string().trim(),
      PUBLIC_REGISTER_COMMERCIAL_CONFIDENTIALITY_REASON_MAX_LENGTH
    )
      .required()
      .messages({
        'string.empty':
          'PUBLIC_REGISTER_COMMERCIAL_CONFIDENTIALITY_REASON_REQUIRED',
        'any.required':
          'PUBLIC_REGISTER_COMMERCIAL_CONFIDENTIALITY_REASON_REQUIRED',
        'string.max':
          'PUBLIC_REGISTER_COMMERCIAL_CONFIDENTIALITY_REASON_MAX_LENGTH'
      })
  })
  .append(marineLicenceId)
