import joi from 'joi'
import { SLUG_PATTERN } from '../../shared/common/constants/iat.js'

export const outcomeDocumentSlugParams = joi.object({
  slug: joi.string().pattern(SLUG_PATTERN).required().messages({
    'string.empty': 'OUTCOME_DOCUMENT_SLUG_REQUIRED',
    'string.pattern.base': 'OUTCOME_DOCUMENT_SLUG_INVALID',
    'any.required': 'OUTCOME_DOCUMENT_SLUG_REQUIRED'
  })
})
