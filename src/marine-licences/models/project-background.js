import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

const PROJECT_BACKGROUND_MAX_TEXT_LENGTH = 1000

export const projectBackgroundSchema = joi
  .object({
    projectBackground: joi
      .string()
      .trim()
      .required()
      .min(1)
      .max(PROJECT_BACKGROUND_MAX_TEXT_LENGTH)
      .messages({
        'string.empty': 'PROJECT_BACKGROUND_REQUIRED',
        'string.min': 'PROJECT_BACKGROUND_REQUIRED',
        'string.max': 'PROJECT_BACKGROUND_MAX_LENGTH',
        'any.required': 'PROJECT_BACKGROUND_REQUIRED'
      })
  })
  .append(marineLicenceId)
