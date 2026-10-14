import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import HapiSwagger from 'hapi-swagger'
import { config } from '../../config.js'

const serviceName = 'Marine Licensing Backend'
const docsTitle = `${serviceName} API Documentation`

const buildSwaggerOptions = (version) => ({
  info: {
    title: docsTitle,
    version,
    description: `API documentation for the ${serviceName}`
  },
  documentationPage: false,
  swaggerUI: false
})

const buildDocumentationPage = (version) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${docsTitle} (${version})</title>
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url="/swagger.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>
`

export const swagger = {
  plugin: {
    name: 'swagger',
    register: async (server) => {
      const version = config.get('serviceVersion') ?? 'local'
      const documentationPage = buildDocumentationPage(version)

      await server.register([
        Inert,
        Vision,
        {
          plugin: HapiSwagger,
          options: buildSwaggerOptions(version)
        }
      ])

      server.route({
        method: 'GET',
        path: '/documentation',
        options: {
          auth: false,
          description: 'Redoc API documentation'
        },
        handler: (_request, h) =>
          h.response(documentationPage).type('text/html')
      })
    }
  }
}
