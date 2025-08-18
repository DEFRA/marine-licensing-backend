import joi from 'joi'

export const multipleSiteDetailsSchema = joi.object({
  multipleSitesEnabled: joi.boolean().default(false)
})
