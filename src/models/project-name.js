import joi from 'joi'
import { exemptionId } from './shared-models.js'
import { projectName, organisation } from './shared/project-name.js'

export { projectName, organisation }

export const createProjectName = projectName
  .append(organisation)
  .append({ mcmsContext: joi.object().allow(null) })

export const updateProjectName = projectName.append(exemptionId)
