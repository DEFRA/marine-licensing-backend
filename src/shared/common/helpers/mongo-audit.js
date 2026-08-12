import {
  getContactId,
  getOptionalContactId
} from '../../helpers/get-contact-id.js'

// `payload ?? {}` rather than a default parameter: hapi sets request.payload to
// null (not undefined) for a request with no body, which a default would not catch.
export const addCreateAuditFields = (auth, payload) => {
  const userId = getContactId(auth)
  const now = new Date()

  const { createdAt, createdBy, updatedAt, updatedBy, ...payloadData } =
    payload ?? {}

  return {
    ...payloadData,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId
  }
}

export const addUpdateAuditFields = (auth, payload) => {
  const userId = getContactId(auth)
  const now = new Date()

  const { updatedAt, updatedBy, ...payloadData } = payload ?? {}

  return {
    ...payloadData,
    updatedAt: now,
    updatedBy: userId
  }
}

export const addCreateAuditFieldsOptional = (auth, payload) => {
  const userId = getOptionalContactId(auth)
  const now = new Date()

  const { createdAt, createdBy, updatedAt, updatedBy, ...payloadData } =
    payload ?? {}

  return {
    ...payloadData,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId
  }
}

export const addUpdateAuditFieldsOptional = (auth, payload) => {
  const userId = getOptionalContactId(auth)
  const now = new Date()

  const { updatedAt, updatedBy, ...payloadData } = payload ?? {}

  return {
    ...payloadData,
    updatedAt: now,
    updatedBy: userId
  }
}
