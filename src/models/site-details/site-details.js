import joi from 'joi'
import { exemptionId } from '../shared-models.js'
import { coordinatesEntryFieldSchema } from './coordinates-entry.js'
import { coordinatesTypeFieldSchema } from './coordinates-type.js'
import { coordinateSystemFieldSchema } from './coordinate-system.js'

export const siteDetailsSchema = joi
  .object({
    siteDetails: joi
      .object({
        coordinatesEntry: coordinatesEntryFieldSchema,
        coordinatesType: coordinatesTypeFieldSchema,
        coordinateSystem: coordinateSystemFieldSchema
      })
      .required()
      .messages({
        'any.required': 'SITE_DETAILS_REQUIRED'
      })
  })
  .append(exemptionId)
