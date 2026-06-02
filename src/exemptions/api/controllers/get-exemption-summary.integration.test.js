import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { COORDINATE_SYSTEMS } from '../../../shared/common/constants/coordinates.js'
import { ObjectId } from 'mongodb'

describe('Get exemption summary - integration tests', () => {
  let server

  beforeAll(async () => {
    const { createServer } = await import('../../../server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop()
  })

  beforeEach(async () => {
    await globalThis.mockMongo.collection(collectionExemptions).deleteMany({})
  })

  test('returns aggregated counts for internal users', async () => {
    const exemptions = [
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.ACTIVE,
        mcmsContext: { articleCode: '25' },
        marinePlanAreas: ['East inshore'],
        coastalOperationsAreas: ['South'],
        siteDetails: [
          {
            coordinatesType: 'file',
            fileUploadType: 'shapefile',
            geoJSON: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [1.076016, 51.474968]
                  },
                  properties: {}
                }
              ]
            },
            featureCount: 1,
            uploadedFile: { filename: 'site.shp' },
            s3Location: {
              s3Bucket: 'bucket',
              s3Key: 'key',
              checksumSha256: 'checksum'
            },
            activityDates: {
              start: new Date('2027-01-01'),
              end: new Date('2027-12-31')
            },
            activityDescription: 'Shapefile activity'
          }
        ]
      }),
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.ACTIVE,
        mcmsContext: { articleCode: '17' },
        marinePlanAreas: ['East inshore', 'South inshore'],
        coastalOperationsAreas: ['South East'],
        siteDetails: [
          {
            coordinatesType: 'file',
            fileUploadType: 'kml',
            geoJSON: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [1.076016, 51.474968]
                  },
                  properties: {}
                }
              ]
            },
            featureCount: 1,
            uploadedFile: { filename: 'site.kml' },
            s3Location: {
              s3Bucket: 'bucket',
              s3Key: 'key-2',
              checksumSha256: 'checksum-2'
            },
            activityDates: {
              start: new Date('2027-01-01'),
              end: new Date('2027-12-31')
            },
            activityDescription: 'KML activity'
          }
        ]
      }),
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.SUBMITTED,
        mcmsContext: { articleCode: '25' },
        siteDetails: [
          {
            coordinatesType: 'coordinates',
            coordinatesEntry: 'single',
            coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
            coordinates: {
              easting: '500000',
              northing: '150000'
            },
            circleWidth: '20',
            activityDates: {
              start: new Date('2027-01-01'),
              end: new Date('2027-12-31')
            },
            activityDescription: 'Manual BNG activity'
          }
        ]
      }),
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.DRAFT,
        siteDetails: [
          {
            coordinatesType: 'coordinates',
            coordinatesEntry: 'single',
            coordinateSystem: COORDINATE_SYSTEMS.WGS84,
            coordinates: {
              latitude: '51.489676',
              longitude: '-0.231530'
            },
            circleWidth: '20',
            activityDates: {
              start: new Date('2027-01-01'),
              end: new Date('2027-12-31')
            },
            activityDescription: 'Draft manual WGS84 activity'
          }
        ]
      }),
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.WITHDRAWN,
        siteDetails: []
      })
    ]

    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertMany(exemptions)

    const { statusCode, body } = await makeGetRequest({
      server,
      url: '/exemptions/summary',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({
      submittedExemptions: 3,
      unsubmittedExemptions: 1,
      withdrawnExemptions: 1,
      coordinatesInputMethod: {
        shapefile: 1,
        kml: 1,
        manualCoordinates: 1
      },
      coordinateSystemVolume: {
        wgs84: { count: 2, percentage: 66.7 },
        bng: { count: 1, percentage: 33.3 },
        total: 3
      },
      byArticle: {
        25: 2,
        17: 1
      },
      byMarinePlanArea: {
        'East inshore': 2,
        'South inshore': 1
      },
      byCoastalOperationsArea: {
        South: 1,
        'South East': 1
      }
    })
  })
})
