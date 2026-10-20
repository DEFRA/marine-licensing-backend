const statusCodeOf = (response) =>
  response.isBoom ? response.output.statusCode : response.statusCode

const describeMismatch = (error) => {
  const path = error.details[0].path.join('.')
  return path ? `${error.message} (at ${path})` : error.message
}

export const logResponseSchemaMismatch = (request, h, error) => {
  const route = `${request.method.toUpperCase()} ${request.route.path}`

  request.logger.warn(
    {
      event: {
        action: 'openapi:response-schema-mismatch',
        reference: `${route} ${statusCodeOf(request.response)}`,
        reason: describeMismatch(error)
      }
    },
    `Response does not match its documented schema: ${route}`
  )

  return h.continue
}
