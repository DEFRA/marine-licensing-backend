import { getContactId } from '../../api/exemptions/helpers/get-contact-id.js'

export const addCreateAuditFields = (payload = {}, auth) => {
  const userId = getContactId(auth)
  const now = new Date()

  const { createdAt, createdBy, updatedAt, updatedBy, ...payloadData } = payload

  return {
    ...payloadData,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId
  }
}

export const addUpdateAuditFields = (payload = {}, auth) => {
  const userId = getContactId(auth)
  const now = new Date()

  const { updatedAt, updatedBy, ...payloadData } = payload

  return {
    ...payloadData,
    updatedAt: now,
    updatedBy: userId
  }
}
