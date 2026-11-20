import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const confirmPublicRegister = joi.object({}).append(marineLicenceId)
