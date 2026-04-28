import joi from 'joi'

const activityTypeValues = ['construction', 'deposit', 'removal']

export const activityTypeFields = {
  activityType: joi
    .string()
    .valid(...activityTypeValues)
    .optional()
    .allow('')
    .messages({
      'any.only': 'ACTIVITY_TYPE_REQUIRED',
      'string.empty': 'ACTIVITY_TYPE_REQUIRED',
      'any.required': 'ACTIVITY_TYPE_REQUIRED'
    }),
  activitySubType: joi.when('activityType', {
    is: joi
      .string()
      .valid(...activityTypeValues)
      .required(),
    then: joi.string().required().messages({
      'string.empty': 'ACTIVITY_SUBTYPE_REQUIRED',
      'any.required': 'ACTIVITY_SUBTYPE_REQUIRED'
    }),
    otherwise: joi.string().optional().allow('').max(0).messages({
      'string.max': 'ACTIVITY_TYPE_REQUIRED'
    })
  }),
  activities: joi.when('activitySubType', {
    is: joi.string().min(1).required(),
    then: joi
      .object({
        selections: joi
          .array()
          .items(joi.string())
          .single()
          .min(1)
          .required()
          .messages({
            'array.min': 'ACTIVITIES_REQUIRED',
            'any.required': 'ACTIVITIES_REQUIRED'
          }),
        otherActivity: joi.when('selections', {
          is: joi.array().has(joi.string().valid('other')),
          then: joi.string().trim().max(1000).required().messages({
            'string.empty': 'ACTIVITIES_OTHER_REASON_REQUIRED',
            'any.required': 'ACTIVITIES_OTHER_REASON_REQUIRED',
            'string.max': 'ACTIVITIES_OTHER_REASON_MAX_LENGTH'
          }),
          otherwise: joi.optional()
        })
      })
      .required()
      .messages({
        'any.required': 'ACTIVITIES_REQUIRED'
      }),
    otherwise: joi.optional()
  })
}
