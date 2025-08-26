import joi from 'joi'

export const multipleSiteDetailsSchema = joi.object({
  multipleSitesEnabled: joi.boolean().default(false).messages({
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
  })
})
