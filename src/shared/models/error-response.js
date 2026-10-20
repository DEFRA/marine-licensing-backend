import joi from 'joi'

export const errorResponseSchema = joi
  .object({
    statusCode: joi.number().integer().required(),
    error: joi.string().required(),
    message: joi.string().allow('').required(),
    validation: joi.object().unknown(true).label('ErrorValidation')
  })
  .label('ErrorResponse')
