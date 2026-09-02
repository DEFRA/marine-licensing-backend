import joi from 'joi'

export const getProjects = joi.object({
  show: joi.string().valid('all-projects', 'my-projects')
})
