import { createProjectName } from '../../models/project-name.js'
import { createProjectNameHandler } from '../../../shared/handlers/create-project-name-handler.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'

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
    collectionName: collectionExemptions,
    status: EXEMPTION_STATUS.DRAFT,
    entityType: 'Exemption'
  })
}
