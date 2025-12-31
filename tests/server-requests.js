export const makeGetRequest = async ({
  url,
  server,
  contactId,
  isInternalUser
}) => {
  const response = await server.inject({
    auth: {
      strategy: 'jwt',
      credentials: { contactId },
      artifacts: { decoded: { tid: isInternalUser ? 'abc' : undefined } }
    },
    method: 'GET',
    url
  })
  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.payload).value
  }
}

export const makeDeleteRequest = async ({ url, server, contactId }) => {
  const response = await server.inject({
    auth: {
      strategy: 'jwt',
      credentials: { contactId },
      artifacts: { decoded: {} }
    },
    method: 'DELETE',
    url
  })
  const parsed = JSON.parse(response.payload)
  return {
    statusCode: response.statusCode,
    body: parsed.value || parsed
  }
}

export const makePostRequest = async ({
  url,
  server,
  contactId,
  payload,
  relationships
}) => {
  const response = await server.inject({
    auth: {
      strategy: 'jwt',
      credentials: { contactId },
      artifacts: { decoded: { relationships } }
    },
    method: 'POST',
    url,
    payload
  })
  const parsed = JSON.parse(response.payload)
  return {
    statusCode: response.statusCode,
    body: parsed.value || parsed
  }
}

export const makePatchRequest = async ({ url, server, contactId, payload }) => {
  const response = await server.inject({
    auth: {
      strategy: 'jwt',
      credentials: { contactId },
      artifacts: { decoded: {} }
    },
    method: 'PATCH',
    url,
    payload
  })
  const parsed = JSON.parse(response.payload)
  return {
    statusCode: response.statusCode,
    body: parsed.value || parsed
  }
}
