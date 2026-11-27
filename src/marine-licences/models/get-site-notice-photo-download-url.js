import joi from 'joi'
import { getMarineLicence } from './get-marine-licence.js'
import { SITE_NOTICE_PHOTO_TYPE } from '../constants/site-notice-evidence.js'

export const getSiteNoticePhotoDownloadUrl = getMarineLicence.keys({
  locationNumber: joi.number().integer().min(1).required(),
  photoType: joi
    .string()
    .valid(...Object.values(SITE_NOTICE_PHOTO_TYPE))
    .required()
})
