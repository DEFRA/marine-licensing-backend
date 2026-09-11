import joi from 'joi'

export const getUsers = joi.object({
  contactIds: joi.array().items(joi.string().uuid()).min(1).required()
})
