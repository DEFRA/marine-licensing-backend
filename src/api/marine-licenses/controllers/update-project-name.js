import { updateProjectName } from '../../../models/marine-licenses/project-name.js'
import { updateProjectNameHandler } from '../../handlers/update-project-name-handler.js'
import { authorizeOwnership } from '../../helpers/authorize-ownership.js'
import { collectionMarineLicenses } from '../../../common/constants/db-collections.js'

export const updateProjectNameController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicenses) }],
    validate: {
      query: false,
      payload: updateProjectName
    }
  },
  handler: updateProjectNameHandler({
    collectionName: collectionMarineLicenses,
    entityType: 'Marine License'
  })
}
