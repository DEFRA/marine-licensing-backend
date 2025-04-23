import joi from 'joi'

export const projectName = joi.object({
  projectName: joi.string().min(1).max(250).required().messages({
    'string.empty': 'PROJECT_NAME_REQUIRED',
    'string.max': 'PROJECT_NAME_MAX_LENGTH',
    'any.required': 'PROJECT_NAME_REQUIRED'
  })
})
