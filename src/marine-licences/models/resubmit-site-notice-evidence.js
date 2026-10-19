import joi from 'joi'
import { MAS_TASK_TYPE } from '../constants/marine-licence.js'
import { marineLicenceId } from './shared-models.js'
import { photoSchema } from './site-notice-evidence.js'

export const resubmitSiteNoticeEvidenceMessageSchema = joi
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

export const updateSiteNoticeResubmissionSchema = joi
  .object({
    taskId: joi.string().length(24).hex().required().messages({
      'string.empty': 'APPLICATION_TASK_ID_REQUIRED',
      'string.length': 'APPLICATION_TASK_ID_REQUIRED',
      'string.hex': 'APPLICATION_TASK_ID_INVALID',
      'any.required': 'APPLICATION_TASK_ID_REQUIRED'
    }),
    locationNumber: joi.number().integer().min(1).required().messages({
      'number.base': 'LOCATION_NUMBER_REQUIRED',
      'number.integer': 'LOCATION_NUMBER_INVALID',
      'number.min': 'LOCATION_NUMBER_INVALID',
      'any.required': 'LOCATION_NUMBER_REQUIRED'
    }),
    closeUpPhoto: photoSchema,
    positionPhoto: photoSchema
  })
  .xor('closeUpPhoto', 'positionPhoto')
  .messages({
    'object.missing': 'SITE_NOTICE_PHOTO_REQUIRED',
    'object.xor': 'SITE_NOTICE_PHOTO_ONE_ONLY'
  })
  .append(marineLicenceId)
