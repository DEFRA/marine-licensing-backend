import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const resolveApplicationTask = joi
  .object({
    taskId: joi.string().length(24).hex().required().messages({
      'string.empty': 'APPLICATION_TASK_ID_REQUIRED',
      'string.length': 'APPLICATION_TASK_ID_REQUIRED',
      'string.hex': 'APPLICATION_TASK_ID_INVALID',
      'any.required': 'APPLICATION_TASK_ID_REQUIRED'
    })
  })
  .append(marineLicenceId)
