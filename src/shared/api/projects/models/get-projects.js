import joi from 'joi'
import { EXEMPTION_STATUS } from '../../../../exemptions/constants/exemption.js'
import { MARINE_LICENCE_STATUS } from '../../../../marine-licences/constants/marine-licence.js'

const PROJECT_STATUS_VALUES = [
  ...new Set([
    ...Object.values(EXEMPTION_STATUS),
    ...Object.values(MARINE_LICENCE_STATUS)
  ])
]

export const getProjects = joi.object({
  show: joi.string().valid('all-projects', 'my-projects'),
  status: joi
    .array()
    .items(joi.string().valid(...PROJECT_STATUS_VALUES))
    .single()
})
