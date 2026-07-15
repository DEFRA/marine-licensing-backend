import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const confirmSiteDetails = joi
  .object({
    confirmed: joi.boolean().required()
  })
  .append(marineLicenceId)
