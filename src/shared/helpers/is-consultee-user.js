import Boom from '@hapi/boom'
import { getOrganisationIdFromAuthToken } from './get-organisation-from-token.js'

// roles entries are relationshipId:roleName:status, for every relationship the user picked
export const getConsulteeOrganisationIdFromAuthToken = (auth) => {
  const { currentRelationshipId, roles } = auth?.artifacts?.decoded || {}
  const organisationId = getOrganisationIdFromAuthToken(auth)

  if (
    !organisationId ||
    !roles?.some((role) =>
      role.startsWith(`${currentRelationshipId}:Consultee`)
    )
  ) {
    throw Boom.forbidden(
      'Not authorised to view consultations: user does not have the Consultee role for this organisation'
    )
  }

  return organisationId
}
