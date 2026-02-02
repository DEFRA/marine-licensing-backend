import { createProjectName } from '../../models/project-name.js'
import { createProjectNameHandler } from '../../../shared/handlers/create-project-name-handler.js'
import { MARINE_LICENSE_STATUS } from '../../constants/marine-license.js'
import { collectionMarineLicenses } from '../../../shared/common/constants/db-collections.js'

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
    collectionName: collectionMarineLicenses,
    status: MARINE_LICENSE_STATUS.DRAFT,
    entityType: 'Marine License'
  })
}
