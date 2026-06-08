import Boom from '@hapi/boom'
import { isApplicantUser } from './is-applicant-user.js'
import { isEntraIdUser } from './is-entra-id-user.js'
import { getContactId } from './get-contact-id.js'
import { getOrganisationIdFromAuthToken } from './get-organisation-from-token.js'
import { notAuthorisedMessage } from '../constants/errors.js'

export const getAuthUserContext = (request) => {
  const isApplicant = isApplicantUser(request)
  const isEntra = isEntraIdUser(request)

  if (!isApplicant && !isEntra) {
    throw Boom.forbidden(notAuthorisedMessage)
  }

  return {
    currentUserId: isApplicant ? getContactId(request.auth) : null,
    currentOrganisationId: isApplicant
      ? getOrganisationIdFromAuthToken(request.auth)
      : null
  }
}
