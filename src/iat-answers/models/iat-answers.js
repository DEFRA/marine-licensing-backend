import joi from 'joi'

export const iatAnswersIdParams = joi.object({
  id: joi.string().length(24).hex().required().messages({
    'string.empty': 'IAT_ANSWERS_ID_REQUIRED',
    'string.length': 'IAT_ANSWERS_ID_REQUIRED',
    'string.hex': 'IAT_ANSWERS_ID_INVALID',
    'any.required': 'IAT_ANSWERS_ID_REQUIRED'
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
