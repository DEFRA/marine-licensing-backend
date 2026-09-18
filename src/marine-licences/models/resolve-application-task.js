import joi from 'joi'

export const resolveApplicationTask = joi.object({
  id: joi.string().length(24).hex().required().messages({
    'string.empty': 'MARINE_LICENCE_ID_REQUIRED',
    'string.length': 'MARINE_LICENCE_ID_REQUIRED',
    'string.hex': 'MARINE_LICENCE_ID_INVALID',
    'any.required': 'MARINE_LICENCE_ID_REQUIRED'
  }),
  taskId: joi.string().length(24).hex().required().messages({
    'string.empty': 'APPLICATION_TASK_ID_REQUIRED',
    'string.length': 'APPLICATION_TASK_ID_REQUIRED',
    'string.hex': 'APPLICATION_TASK_ID_INVALID',
    'any.required': 'APPLICATION_TASK_ID_REQUIRED'
  })
})
