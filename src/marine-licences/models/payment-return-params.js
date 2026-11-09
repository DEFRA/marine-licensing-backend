import joi from 'joi'

export const paymentReturnParams = joi.object({
  returnId: joi.string().guid({ version: 'uuidv4' }).required()
})
