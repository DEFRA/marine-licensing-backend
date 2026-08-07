import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const copyMarineLicence = joi.object({}).append(marineLicenceId)
