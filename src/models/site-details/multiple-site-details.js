import joi from 'joi'

export const multipleSiteDetailsSchema = joi.object({
  multipleSitesEnabled: joi.boolean().messages({
    'boolean.base': 'MULTIPLE_SITES_REQUIRED'
  }),
  sameActivityDates: joi.when('multipleSitesEnabled', {
    is: true,
    then: joi.string().valid('yes', 'no').required().messages({
      'any.only': 'SAME_ACTIVITY_DATES_REQUIRED',
      'string.empty': 'SAME_ACTIVITY_DATES_REQUIRED',
      'any.required': 'SAME_ACTIVITY_DATES_REQUIRED'
    }),
    otherwise: joi.forbidden()
  }),
  sameActivityDescription: joi.when('multipleSitesEnabled', {
    is: true,
    then: joi.string().valid('yes', 'no').required().messages({
      'any.only': 'SAME_ACTIVITY_DESCRIPTION_REQUIRED',
      'string.empty': 'SAME_ACTIVITY_DESCRIPTION_REQUIRED',
      'any.required': 'SAME_ACTIVITY_DESCRIPTION_REQUIRED'
    }),
    otherwise: joi.forbidden()
  })
})
