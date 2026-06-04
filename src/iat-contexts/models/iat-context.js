import joi from 'joi'
import { SLUG_PATTERN } from '../../shared/common/constants/iat.js'

const ROUTE_MAX = 200
const TEXT_MAX = 5000
const ANSWER_ID_MAX = 100
const MAPPING_MAX = 100

export const iatContextSlugParams = joi.object({
  slug: joi.string().pattern(SLUG_PATTERN).required().messages({
    'string.empty': 'IAT_CONTEXT_SLUG_REQUIRED',
    'string.pattern.base': 'IAT_CONTEXT_SLUG_INVALID',
    'any.required': 'IAT_CONTEXT_SLUG_REQUIRED'
  })
})

const ANSWERS_PER_ENTRY_MAX = 50

const selectedAnswerSchema = joi.object({
  id: joi.string().max(ANSWER_ID_MAX).required(),
  text: joi.string().max(TEXT_MAX).required()
})

const answerSchema = joi.object({
  questionRoute: joi.string().max(ROUTE_MAX).required(),
  questionText: joi.string().max(TEXT_MAX).required(),
  answers: joi
    .array()
    .items(selectedAnswerSchema)
    .min(1)
    .max(ANSWERS_PER_ENTRY_MAX)
    .required(),
  mcmsAppFormMapping: joi.string().max(MAPPING_MAX).allow(null).required()
})

export const iatContextPatchBody = joi.object({
  answer: answerSchema.required()
})

const paramSchema = joi.object({
  name: joi.string().max(MAPPING_MAX).required(),
  value: joi.string().max(TEXT_MAX).required()
})

const focusedOptionSchema = joi.object({
  id: joi.string().max(ANSWER_ID_MAX).required(),
  heading: joi.string().max(TEXT_MAX).allow('').required(),
  text: joi.string().max(TEXT_MAX).allow('').required(),
  module: joi.string().max(MAPPING_MAX).allow(null).required(),
  link: joi.string().max(TEXT_MAX).allow(null).required(),
  overrideCtaButtonUrl: joi.string().max(TEXT_MAX).allow(null).required(),
  params: joi.array().items(paramSchema).allow(null).required()
})

export const outcomeDocumentMintBody = joi.object({
  preamble: joi.string().max(TEXT_MAX).allow('').required(),
  outcomeRoute: joi.string().max(ROUTE_MAX).required(),
  outcomeKind: joi
    .string()
    .valid('terminal-single', 'terminal-multi', 'intermediate')
    .required(),
  outcomeHeading: joi.string().max(TEXT_MAX).allow('').required(),
  outcomeText: joi.string().max(TEXT_MAX).allow('').required(),
  focusedOption: focusedOptionSchema.required()
})
