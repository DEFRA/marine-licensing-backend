import joi from 'joi'

export const activityDatesSchema = joi.object({
  activityStartDate: joi.date().required().messages({
    'date.base': 'ACTIVITY_START_DATE_INVALID',
    'any.required': 'ACTIVITY_START_DATE_REQUIRED'
  }),
  activityEndDate: joi.date().required().messages({
    'date.base': 'ACTIVITY_END_DATE_INVALID',
    'any.required': 'ACTIVITY_END_DATE_REQUIRED'
  })
})
