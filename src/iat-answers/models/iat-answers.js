import joi from 'joi'

const ROUTE_MAX_LENGTH = 200

export const iatAnswersSlugParams = joi.object({
  slug: joi
    .string()
    .pattern(/^[A-Za-z0-9_-]{22}$/)
    .required()
    .messages({
      'string.empty': 'IAT_ANSWERS_SLUG_REQUIRED',
      'string.pattern.base': 'IAT_ANSWERS_SLUG_INVALID',
      'any.required': 'IAT_ANSWERS_SLUG_REQUIRED'
    })
})

const ANSWER_LOG_MAX = 200
const ANSWER_IDS_PER_ENTRY_MAX = 50
const ANSWER_ID_MAX = 100

const questionLogEntry = joi.object({
  type: joi.string().valid('question').required(),
  questionRoute: joi.string().max(ROUTE_MAX_LENGTH).required(),
  answerIds: joi
    .array()
    .items(joi.string().max(ANSWER_ID_MAX))
    .min(1)
    .max(ANSWER_IDS_PER_ENTRY_MAX)
    .required()
})

const outcomeLogEntry = joi.object({
  type: joi.string().valid('outcome').required(),
  outcomeRoute: joi.string().max(ROUTE_MAX_LENGTH).required(),
  outcomeTypeId: joi.string().max(ANSWER_ID_MAX).required()
})

export const iatAnswersPatchBody = joi.object({
  answers: joi
    .array()
    .items(joi.alternatives().try(questionLogEntry, outcomeLogEntry))
    .max(ANSWER_LOG_MAX)
    .required()
})
