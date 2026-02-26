import { createProjectName } from '../../models/project-name.js'
import { createProjectNameHandler } from '../../../shared/handlers/create-project-name-handler.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

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
    collectionName: collectionMarineLicences,
    status: MARINE_LICENCE_STATUS.DRAFT,
    entityType: 'Marine Licence'
  })
}
