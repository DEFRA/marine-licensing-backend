import { updateProjectName } from '../../../models/marine-licenses/project-name.js'
import { updateProjectNameHandler } from '../../handlers/update-project-name-handler.js'
import { authorizeOwnership } from '../../helpers/authorize-ownership.js'
import { marineLicenses } from '../../../common/constants/db-collections.js'

export const updateProjectNameController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(marineLicenses) }],
    validate: {
      query: false,
      payload: updateProjectName
    }
  },
  handler: updateProjectNameHandler({
    collectionName: marineLicenses,
    entityType: 'Marine License'
  })
}
