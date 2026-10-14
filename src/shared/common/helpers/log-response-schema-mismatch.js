const statusCodeOf = (response) =>
  response.isBoom ? response.output.statusCode : response.statusCode

export const logResponseSchemaMismatch = (request, h, error) => {
  const route = `${request.method.toUpperCase()} ${request.route.path}`

  request.logger.warn(
    {
      event: {
        action: 'openapi:response-schema-mismatch',
        reference: `${route} ${statusCodeOf(request.response)}`,
        reason: error.message
      }
    },
    `Response does not match its documented schema: ${route}`
  )

  return h.continue
}
