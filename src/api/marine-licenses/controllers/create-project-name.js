import { createProjectName } from '../../../models/marine-licenses/project-name.js'
import { createProjectNameHandler } from '../../handlers/create-project-name-handler.js'
import { MARINE_LICENSE_STATUS } from '../../../common/constants/marine-license.js'
import { marineLicenses } from '../../../common/constants/db-collections.js'

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
    collectionName: marineLicenses,
    status: MARINE_LICENSE_STATUS.DRAFT,
    entityType: 'Marine License'
  })
}
