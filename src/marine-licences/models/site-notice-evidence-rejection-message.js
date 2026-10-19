import joi from 'joi'
import { MAS_TASK_TYPE } from '../constants/marine-licence.js'

export const siteNoticeEvidenceRejectionMessageSchema = joi
  .object({
    applicationReference: joi.string().trim().min(1).required(),
    taskType: joi
      .string()
      .valid(MAS_TASK_TYPE.PUBLIC_NOTICE_EVIDENCE)
      .required(),
    userName: joi.string().allow('', null),
    userEmail: joi.string().allow('', null),
    rejectedLocations: joi
      .array()
      .items(
        joi
          .object({
            locationNumber: joi.number().integer().min(1).required(),
            reason: joi.string().trim().min(1).required()
          })
          .unknown(true)
      )
      .min(1)
      .unique('locationNumber')
      .required()
  })
  .unknown(true)
