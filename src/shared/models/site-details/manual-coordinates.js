import joi from 'joi'
import { coordinatesEntryFieldSchema } from './coordinates-entry.js'
import { coordinateSystemFieldSchema } from './coordinate-system.js'
import { circleWidthValidationSchema } from './circle-width.js'

export const manualCoordinatesConditionalSiteItemFields = {
  coordinatesEntry: joi.when('coordinatesType', {
    is: 'coordinates',
    then: coordinatesEntryFieldSchema,
    otherwise: joi.forbidden()
  }),
  coordinateSystem: joi.when('coordinatesType', {
    is: 'coordinates',
    then: coordinateSystemFieldSchema,
    otherwise: joi.forbidden()
  }),
  circleWidth: joi.when('coordinatesType', {
    is: 'coordinates',
    then: joi.alternatives().conditional('coordinatesEntry', {
      is: 'single',
      then: circleWidthValidationSchema,
      otherwise: joi.forbidden()
    }),
    otherwise: joi.forbidden()
  })
}
