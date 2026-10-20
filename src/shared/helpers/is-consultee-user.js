import Boom from '@hapi/boom'
import { getOrganisationIdFromAuthToken } from './get-organisation-from-token.js'

const CONSULTEE_ROLE_NAME = 'Consultee'

export const getConsulteeOrganisationIdFromAuthToken = (auth) => {
  const { currentRelationshipId, roles } = auth?.artifacts?.decoded || {}
  const organisationId = getOrganisationIdFromAuthToken(auth)

  // role format:
  // relationshipId:roleName:status
  const isConsultee = roles?.some((role) => {
    const [relationshipId, roleName] = role.split(':')
    return (
      relationshipId === currentRelationshipId &&
      roleName === CONSULTEE_ROLE_NAME
    )
  })

  if (!organisationId || !isConsultee) {
    throw Boom.forbidden(
      'Not authorised to view consultations: user does not have the Consultee role for this organisation'
    )
  }

  return organisationId
}
