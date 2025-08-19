import joi from 'joi'

export const multipleSiteDetailsSchema = joi.object({
  multipleSitesEnabled: joi.boolean().default(false).messages({
    'boolean.base': 'MULTIPLE_SITES_REQUIRED'
  })
})
