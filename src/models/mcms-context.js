import joi from 'joi'
import {
  activityTypes,
  articleCodes
} from '../common/constants/mcms-context.js'

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
      .pattern(
        /^https:\/\/[^/]+\.marinemanagement\.org\.uk\/[^/]+\/journey\/self-service\/outcome-document\/[a-zA-Z0-9-]+$/
      ),
    iatQueryString: joi.string().required()
  })
  .allow(null)
