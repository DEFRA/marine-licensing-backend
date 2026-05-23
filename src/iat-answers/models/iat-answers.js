import joi from 'joi'

const ROUTE_MAX_LENGTH = 200
const TEXT_MAX_LENGTH = 500
const ANSWERS_PER_QUESTION_MAX = 50

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

const answerItem = joi.object({
  id: joi.string().max(100).required(),
  text: joi.string().max(TEXT_MAX_LENGTH).required()
})

const answerEntry = joi.object({
  questionRoute: joi.string().max(ROUTE_MAX_LENGTH).required(),
  questionText: joi.string().max(TEXT_MAX_LENGTH).required(),
  answers: joi
    .array()
    .items(answerItem)
    .min(1)
    .max(ANSWERS_PER_QUESTION_MAX)
    .required()
})

export const iatAnswersBody = joi.object({
  outcome: joi
    .object({
      route: joi.string().max(ROUTE_MAX_LENGTH).required(),
      typeId: joi.string().max(100).required(),
      summaryText: joi.string().max(1000).required()
    })
    .required(),
  answers: joi.array().items(answerEntry).min(1).max(100).required()
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
