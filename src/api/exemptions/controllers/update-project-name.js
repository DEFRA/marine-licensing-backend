import { updateProjectName } from '../../../models/project-name.js'
import { collectionExemptions } from '../../../common/constants/db-collections.js'
import { updateProjectNameHandler } from '../../handlers/update-project-name-handler.js'
import { authorizeOwnership } from '../../helpers/authorize-ownership.js'

export const updateProjectNameController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionExemptions) }],
    validate: {
      query: false,
      payload: updateProjectName
    }
  },
  handler: updateProjectNameHandler({
    collectionName: collectionExemptions,
    entityType: 'Exemption'
  })
}
