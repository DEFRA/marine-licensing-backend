import Boom from '@hapi/boom'
import { getOrganisationDetailsFromAuthToken } from './get-organisation-from-token.js'

export const getConsulteeOrganisationIdFromAuthToken = (auth) => {
  const { organisationId, userRelationshipType } =
    getOrganisationDetailsFromAuthToken(auth)

  if (userRelationshipType !== 'Consultee' || !organisationId) {
    throw Boom.forbidden(
      'Not authorised to view consultations: user is not signed in as a consultee organisation'
    )
  }

  return organisationId
}
