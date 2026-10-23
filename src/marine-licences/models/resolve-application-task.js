import joi from 'joi'
import { applicationTaskId, marineLicenceId } from './shared-models.js'

export const resolveApplicationTask = joi
  .object(applicationTaskId)
  .append(marineLicenceId)
