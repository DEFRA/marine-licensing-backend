import { createProjectName } from '../../../models/project-name.js'
import { createProjectNameHandler } from '../../handlers/create-project-name-handler.js'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'

export const createProjectNameController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    validate: {
      query: false,
      payload: createProjectName
    }
  },
  handler: createProjectNameHandler({
    collectionName: 'exemptions',
    status: EXEMPTION_STATUS.DRAFT,
    entityType: 'Exemption'
  })
}
