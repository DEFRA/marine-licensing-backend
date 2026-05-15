import joi from 'joi'

export const iatAnswersSlugParams = joi.object({
  slug: joi
    .string()
    .length(22)
    .pattern(/^[A-Za-z0-9_-]{22}$/)
    .required()
    .messages({
      'string.empty': 'IAT_ANSWERS_SLUG_REQUIRED',
      'string.length': 'IAT_ANSWERS_SLUG_INVALID',
      'string.pattern.base': 'IAT_ANSWERS_SLUG_INVALID',
      'any.required': 'IAT_ANSWERS_SLUG_REQUIRED'
    })
})

const answerItem = joi.object({
  id: joi.string().max(100).required(),
  text: joi.string().max(500).required()
})

const answerEntry = joi.object({
  questionRoute: joi.string().max(200).required(),
  questionText: joi.string().max(500).required(),
  answers: joi.array().items(answerItem).min(1).max(50).required()
})

export const iatAnswersBody = joi.object({
  outcome: joi
    .object({
      route: joi.string().max(200).required(),
      typeId: joi.string().max(100).required(),
      summaryText: joi.string().max(1000).required()
    })
    .required(),
  answers: joi.array().items(answerEntry).min(1).max(100).required()
})
