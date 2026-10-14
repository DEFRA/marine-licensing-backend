import joi from 'joi'

const publicExemptionSchema = joi
  .object({
    id: joi.string().hex().length(24).required(),
    status: joi.string().required(),
    projectName: joi.string(),
    applicationReference: joi.string(),
    whoExemptionIsFor: joi.string(),
    publicRegister: joi.object().unknown(true),
    siteDetails: joi.array().items(joi.object().unknown(true)),
    submittedAt: joi.date(),
    withdrawnAt: joi.date().allow(null),
    createdAt: joi.date(),
    updatedAt: joi.date(),
    taskList: joi.object().pattern(joi.string(), joi.string()).required()
  })
  .unknown(true)
  .label('PublicExemption')

export const publicExemptionResponseSchema = joi
  .object({
    message: joi.string().valid('success').required(),
    value: publicExemptionSchema.required()
  })
  .label('PublicExemptionResponse')
