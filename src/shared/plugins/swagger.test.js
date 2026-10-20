import { config } from '../../config.js'
import { COORDINATES_ZIP_FILENAME } from '../../marine-licences/constants/coordinates-csv.js'

const startServer = async () => {
  const { createServer } = await import('../../server.js')
  const server = await createServer()
  await server.initialize()
  return server
}

describe('swagger plugin', () => {
  describe('outside prod', () => {
    let server

    const getSpec = async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/swagger.json'
      })
      return result
    }

    beforeAll(async () => {
      server = await startServer()
    })

    afterAll(async () => {
      await server?.stop()
    })

    test('serves the Redoc documentation page', async () => {
      const { statusCode, headers, payload } = await server.inject({
        method: 'GET',
        url: '/documentation'
      })

      expect(statusCode).toBe(200)
      expect(headers['content-type']).toContain('text/html')
      expect(payload).toContain('<redoc spec-url="/swagger.json"></redoc>')
      expect(payload).toContain(
        '<script src="https://cdn.jsdelivr.net/npm/redoc@2.5.4/bundles/redoc.standalone.js" integrity="sha384-w447zOpYfw/1Tv/5AK9NfHTlQIqE3RVR6KY62jCyy9zNDgO64cMwGGP1Fj0zJVf5" crossorigin="anonymous"></script>'
      )
      expect(payload).not.toContain('latest')
      expect(payload).toContain(
        '<title>Marine Licensing Backend API Documentation (local)</title>'
      )
    })

    test('serves the OpenAPI spec without authentication', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/swagger.json'
      })

      expect(statusCode).toBe(200)
      expect(result.info).toEqual({
        title: 'Marine Licensing Backend API Documentation',
        version: 'local',
        description: 'API documentation for the Marine Licensing Backend'
      })
    })

    test('gives every schema definition a PascalCase name from a Joi label', async () => {
      const spec = await getSpec()
      const unnamed = Object.keys(spec.definitions).filter(
        (name) => !/^[A-Z][A-Za-z]+$/.test(name)
      )

      expect(unnamed).toEqual([])
    })

    test.each([
      ['PublicRegister', 'withholdConsent'],
      ['SpecialLegalPowers', 'agree'],
      ['HarbourAuthority', 'area'],
      ['OtherAuthorities', 'agree'],
      ['PublicConsultation', 'consulted'],
      ['WaterFrameworkDirective', 'nauticalMile'],
      ['WaterFrameworkDirective', 'excludedActivities']
    ])('documents %s.%s as a yes or no answer', async (definition, field) => {
      const spec = await getSpec()
      const { $ref } = spec.definitions[definition].properties[field]
      const answer = spec.definitions[$ref.replace('#/definitions/', '')]

      expect(answer.enum).toEqual(['yes', 'no'])
    })

    test.each([
      ['MarineLicence', 'projectName', 250],
      ['MarineLicence', 'projectBackground', 1000],
      ['PublicRegister', 'reason', 1000],
      ['SpecialLegalPowers', 'details', 1000],
      ['HarbourAuthority', 'details', 1000],
      ['OtherAuthorities', 'details', 1000],
      ['PublicConsultation', 'details', 1000],
      ['Site', 'siteName', 250],
      ['Activity', 'otherActivity', 1000],
      ['Activity', 'activityDescription', 1000],
      ['Activity', 'workingHours', 1000],
      ['ActivityMonths', 'details', 1000],
      ['CompletionDate', 'reason', 1000],
      ['MarinePlanPolicy', 'policyCode', 100],
      ['MarinePlanPolicy', 'applicantAnswer', 5000]
    ])(
      'documents the maximum length of %s.%s',
      async (definition, field, maxLength) => {
        const spec = await getSpec()

        expect(spec.definitions[definition].properties[field].maxLength).toBe(
          maxLength
        )
      }
    )

    test.each([
      ['MarineLicence', 'withdrawnAt', 'ISO 8601 UTC timestamp'],
      ['MarineLicence', 'preferredLicenceDates', 'Month YYYY to Month YYYY'],
      ['Activity', 'activityDuration', 'years and/or months'],
      ['Activity', 'activityIndex', 'Zero-based'],
      ['WaterFrameworkDirective', 'documentUrl', 'Not the document itself'],
      ['UploadedFile', 'presignedFileUrl', 'Expires after 4 hours'],
      ['Site', 'siteIndex', 'Zero-based'],
      ['Site', 'circleWidthMetres', 'diameter in metres'],
      ['Site', 'coordinateSystem', 'geometry is always WGS84 (EPSG:4326)'],
      ['Site', 'locationMethod', "'Manual coordinate entry'"],
      ['CompletionDate', 'hasSpecificDate', 'Not a date'],
      [
        'Site',
        'coordinatesEntry',
        "'Enter multiple sets of coordinates to mark the boundary of the site'"
      ],
      ['Site', 'coordinateSystem', "'British National Grid (OSGB36)'"],
      ['MarinePlanPolicy', 'policyInformation', 'sanitised HTML'],
      ['WfdDocumentDownloadUrl', 'expiresIn', 'in seconds']
    ])('describes %s.%s', async (definition, field, text) => {
      const spec = await getSpec()

      expect(
        spec.definitions[definition].properties[field].description
      ).toContain(text)
    })

    test.each([
      ['PublicRegister', 'Do you want to request that information is withheld'],
      [
        'SpecialLegalPowers',
        'Does your organisation have special legal powers'
      ],
      ['HarbourAuthority', 'located in a harbour authority area'],
      ['OtherAuthorities', 'got permission from, any other authorities'],
      ['PublicConsultation', 'consulted with any public groups'],
      ['WaterFrameworkDirective', 'within one nautical mile'],
      ['SiteGeometry', 'WGS84 (EPSG:4326)']
    ])('describes the %s object', async (definition, text) => {
      const spec = await getSpec()

      expect(spec.definitions[definition].description).toContain(text)
    })

    test.each([
      ['MarineLicence', 'withdrawnAt', '2026-09-15T10:30:00.000Z'],
      [
        'MarineLicence',
        'preferredLicenceDates',
        'August 2026 to November 2026'
      ],
      ['Activity', 'activityDuration', '1 year 6 months'],
      ['MarinePlanPolicy', 'policyCode', 'E-AGG-3']
    ])('gives an example for %s.%s', async (definition, field, example) => {
      const spec = await getSpec()

      expect(spec.definitions[definition].properties[field].example).toBe(
        example
      )
    })

    test('does not mention the CDP gateway anywhere consumers read', async () => {
      const spec = await getSpec()

      expect(JSON.stringify(spec)).not.toMatch(/gateway/i)
    })

    test('leaves untagged routes out of the spec', async () => {
      const spec = await getSpec()

      expect(spec.paths['/exemption/{id}']).toBeUndefined()
      expect(spec.paths['/health']).toBeUndefined()
      expect(spec.paths['/public/exemption/{id}']).toBeUndefined()
      expect(spec.paths['/public/marine-licence/{id}']).toBeUndefined()
    })

    test('documents the marine licence MAS route', async () => {
      const spec = await getSpec()
      const operation = spec.paths['/public/marine-licence/mas/{id}'].get

      expect(operation.summary).toBe('Get a submitted marine licence for MAS')
      expect(operation.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'id', in: 'path', required: true })
        ])
      )
      expect(Object.keys(operation.responses).sort()).toEqual([
        '200',
        '400',
        '403',
        '404',
        '500'
      ])
      expect(operation.responses['403'].description).toBe(
        'The marine licence is a draft'
      )
      expect(spec.definitions.MarineLicence.properties).toHaveProperty('sites')
    })

    test('documents the MAS withdrawal time as a date-time', async () => {
      const spec = await getSpec()

      expect(spec.definitions.MarineLicence.properties.withdrawnAt).toEqual(
        expect.objectContaining({ format: 'date-time' })
      )
    })

    test('documents that the MAS route serves any marine licence that is not a draft and that fields may be null', async () => {
      const spec = await getSpec()
      const { description } = spec.paths['/public/marine-licence/mas/{id}'].get

      expect(description).toContain('any marine licence that is not a draft')
      expect(description).toContain('may be null')
    })

    test('documents that the Water Framework Directive route serves any marine licence that is not a draft', async () => {
      const spec = await getSpec()
      const { description } =
        spec.paths[
          '/public/marine-licence/{id}/water-framework-directive/download-url'
        ].get

      expect(description).toContain('any marine licence that is not a draft')
    })

    test('documents the Water Framework Directive download URL route', async () => {
      const spec = await getSpec()
      const operation =
        spec.paths[
          '/public/marine-licence/{id}/water-framework-directive/download-url'
        ].get

      expect(operation.summary).toBe(
        'Get a download URL for a marine licence Water Framework Directive document'
      )
      expect(Object.keys(operation.responses).sort()).toEqual([
        '200',
        '400',
        '403',
        '404',
        '500'
      ])
      expect(spec.definitions).toHaveProperty('WfdDocumentDownloadUrlResponse')
    })

    test('documents the coordinates download route as a ZIP file', async () => {
      const spec = await getSpec()
      const operation =
        spec.paths['/public/marine-licence/{id}/generate-coordinates-csv'].get

      expect(operation.summary).toBe(
        'Download the site coordinates of a submitted marine licence'
      )
      expect(operation.produces).toEqual(['application/zip'])
      expect(operation.responses['200']).toEqual({
        description: 'A ZIP file of site coordinate CSVs',
        schema: { type: 'file' },
        headers: {
          'Content-Disposition': {
            type: 'string',
            description: `attachment; filename="${COORDINATES_ZIP_FILENAME}"`
          }
        }
      })
      expect(Object.keys(operation.responses).sort()).toEqual([
        '200',
        '400',
        '403',
        '404',
        '500'
      ])
    })
  })

  describe('with a deployed service version', () => {
    let server
    let originalVersion

    beforeAll(async () => {
      originalVersion = config.get('serviceVersion')
      config.set('serviceVersion', '9.0.0')
      server = await startServer()
    })

    afterAll(async () => {
      config.set('serviceVersion', originalVersion)
      await server?.stop()
    })

    test('reports the service version in the spec and page title', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/swagger.json'
      })
      const { payload } = await server.inject({
        method: 'GET',
        url: '/documentation'
      })

      expect(result.info.version).toBe('9.0.0')
      expect(payload).toContain(
        '<title>Marine Licensing Backend API Documentation (9.0.0)</title>'
      )
    })
  })

  describe('in prod', () => {
    let server
    let originalEnvironment

    beforeAll(async () => {
      originalEnvironment = config.get('cdpEnvironment')
      config.set('cdpEnvironment', 'prod')
      server = await startServer()
    })

    afterAll(async () => {
      config.set('cdpEnvironment', originalEnvironment)
      await server?.stop()
    })

    test.each(['/swagger.json', '/documentation'])(
      'does not serve %s',
      async (url) => {
        const { statusCode } = await server.inject({ method: 'GET', url })

        expect(statusCode).toBe(404)
      }
    )
  })
})
