import joi from 'joi'

const SLUG_PATTERN = /^[A-Za-z0-9_-]{22}$/

export const outcomeDocumentSlugParams = joi.object({
  slug: joi.string().pattern(SLUG_PATTERN).required().messages({
    'string.empty': 'OUTCOME_DOCUMENT_SLUG_REQUIRED',
    'string.pattern.base': 'OUTCOME_DOCUMENT_SLUG_INVALID',
    'any.required': 'OUTCOME_DOCUMENT_SLUG_REQUIRED'
  })
})
