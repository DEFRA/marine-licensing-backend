import joi from 'joi'
import { marineLicenceId } from './shared-models.js'
import { projectName, organisation } from '../../shared/models/project-name.js'

export const createProjectName = projectName
  .append(organisation)
  .append({ mcmsContext: joi.object().allow(null) })

export const updateProjectName = projectName.append(marineLicenceId)
