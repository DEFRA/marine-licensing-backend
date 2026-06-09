import joi from 'joi'
import { config } from '../../config.js'
import {
  activityTypes,
  articleCodes
} from '../../shared/common/constants/mcms-context.js'

const NEW_DOC_PATH =
  /^\/journey\/self-service\/outcome-document\/[A-Za-z0-9_-]+$/
const MCMS_DOC_PATH =
  /^\/[^/]+\/journey\/self-service\/outcome-document\/[A-Za-z0-9_-]+$/

function frontendHost() {
  try {
    return new URL(config.get('frontEndBaseUrl')).host
  } catch {
    return null
  }
}

function isMcmsHost(host) {
  return /^[^.]+\.marinemanagement\.org\.uk$/.test(host)
}

function isOwnHost(host) {
  return host === frontendHost()
}

function validatePdfDownloadUrl(value, helpers) {
  let url
  try {
    url = new URL(value)
  } catch {
    return helpers.error('any.invalid')
  }
  if (isMcmsHost(url.host)) {
    if (url.protocol !== 'https:') {
      return helpers.error('any.invalid')
    }
    if (!MCMS_DOC_PATH.test(url.pathname)) {
      return helpers.error('any.invalid')
    }
    return value
  }
  if (isOwnHost(url.host)) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return helpers.error('any.invalid')
    }
    if (!NEW_DOC_PATH.test(url.pathname)) {
      return helpers.error('any.invalid')
    }
    return value
  }
  return helpers.error('any.invalid')
}

export const mcmsContext = joi
  .object({
    activityType: joi
      .string()
      .required()
      .valid(...Object.keys(activityTypes)),
    article: joi
      .string()
      .required()
      .valid(...articleCodes),
    pdfDownloadUrl: joi
      .string()
      .required()
      .custom(validatePdfDownloadUrl, 'pdfDownloadUrl validation'),
    iatQueryString: joi.string().required()
  })
  .allow(null)
