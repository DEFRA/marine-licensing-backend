import { updateProjectName } from '../../models/project-name.js'
import { updateProjectNameHandler } from '../../../shared/handlers/update-project-name-handler.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

export const updateProjectNameController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: updateProjectName
    }
  },
  handler: updateProjectNameHandler({
    collectionName: collectionMarineLicences,
    entityType: 'Marine Licence'
  })
}
