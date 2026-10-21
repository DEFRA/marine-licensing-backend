import Boom from '@hapi/boom'
import { getOrganisationIdFromAuthToken } from './get-organisation-from-token.js'

const CONSULTEE_ROLE_NAME = 'Consultee'
// 3 = Complete (approved); pending, rejected, blocked, removed and offboarded are refused
const ROLE_STATUS_APPROVED = '3'

export const getConsulteeOrganisationIdFromAuthToken = (auth) => {
  const { currentRelationshipId, roles } = auth?.artifacts?.decoded || {}
  const organisationId = getOrganisationIdFromAuthToken(auth)

  // role format:
  // relationshipId:roleName:status
  const isConsultee = roles?.some((role) => {
    const [relationshipId, roleName, status] = role.split(':')
    return (
      relationshipId === currentRelationshipId &&
      roleName === CONSULTEE_ROLE_NAME &&
      status === ROLE_STATUS_APPROVED
    )
  })

  if (!organisationId || !isConsultee) {
    throw Boom.forbidden(
      'Not authorised to view consultations: user does not have an approved Consultee role for this organisation'
    )
  }

  return organisationId
}
