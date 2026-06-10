import joi from 'joi'
import { marineLicenceId } from './shared-models.js'

export const calculatePoliciesSchema = joi.object().append(marineLicenceId)
