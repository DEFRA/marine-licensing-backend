import joi from 'joi'
import { COORDINATE_SYSTEMS } from '../../common/constants/coordinates'

export const coordinateSystemFieldSchema = joi
  .string()
  .valid(COORDINATE_SYSTEMS.OSGB36, COORDINATE_SYSTEMS.WGS84)
  .required()
  .messages({
    'any.only': 'COORDINATE_SYSTEM_REQUIRED',
    'string.empty': 'COORDINATE_SYSTEM_REQUIRED',
    'any.required': 'COORDINATE_SYSTEM_REQUIRED'
  })
