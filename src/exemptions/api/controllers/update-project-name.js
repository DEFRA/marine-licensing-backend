import { updateProjectName } from '../../models/project-name.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { updateProjectNameHandler } from '../../../shared/handlers/update-project-name-handler.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'

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
