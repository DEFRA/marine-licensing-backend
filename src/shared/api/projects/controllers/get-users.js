import { StatusCodes } from 'http-status-codes'
import { getContactId } from '../../../helpers/get-contact-id.js'
import { getOrganisationDetailsFromAuthToken } from '../../../helpers/get-organisation-from-token.js'
import { batchGetContactNames } from '../../../common/helpers/dynamics/get-contact-details.js'
import { getUsers } from '../models/get-users.js'
import { getOrganisationContactIds } from './utils.js'
import Boom from '@hapi/boom'

export const getUsersController = {
  options: {
    validate: {
      payload: getUsers
    }
  },
  handler: async (request, h) => {
    const { db, auth, payload } = request
    getContactId(auth)
    const { organisationId, userRelationshipType } =
      getOrganisationDetailsFromAuthToken(auth)

    if (userRelationshipType !== 'Employee' || !organisationId) {
      throw Boom.forbidden(
        `Not authorised to get user names for this organisation`
      )
    }

    const orgContactIds = new Set(
      await getOrganisationContactIds(db, organisationId)
    )
    const scopedContactIds = payload.contactIds.filter((id) =>
      orgContactIds.has(id)
    )

    const users = await batchGetContactNames(scopedContactIds)

    return h.response({ message: 'success', value: users }).code(StatusCodes.OK)
  }
}
