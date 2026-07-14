import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../tests/test-server.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { buildCoordinatesCsvPathById } from '../../constants/coordinates-csv.js'

describe('Generate coordinates CSV by id - public integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()

  const insertSubmittedMarineLicence = async (overrides = {}) => {
    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: marineLicenceId,
      status: MARINE_LICENCE_STATUS.SUBMITTED,
      siteDetails: [
        {
          coordinatesType: 'polygon',
          coordinatesEntry: 'multiple',
          coordinateSystem: 'wgs84',
          coordinates: [
            { latitude: '51.5', longitude: '-0.1' },
            { latitude: '51.6', longitude: '-0.2' }
          ]
        }
      ],
      ...overrides
    })
  }

  test('returns 200 with correct headers without authentication', async () => {
    await insertSubmittedMarineLicence()

    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="locationForCSV.csv"'
    )

    const firstLine = response.payload.split('\n')[0]
    expect(firstLine).toBe(
      'Lat Degree,Lat Dec Min,Long Degree,Long Dec Min,objectid'
    )
  })

  test('returns CSV rows for a submitted marine licence', async () => {
    await insertSubmittedMarineLicence()

    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(200)

    const lines = response.payload.split('\n').filter(Boolean)
    expect(lines).toHaveLength(4)
    expect(lines[1]).toBe('51,30,0,6,1')
    expect(lines[2]).toBe('51,36,0,12,1')
    expect(lines[3]).toBe('51,30,0,6,1')
  })

  test('returns 404 when the marine licence id is not found', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(new ObjectId().toHexString())
    })

    expect(response.statusCode).toBe(404)
  })

  test('returns 400 when the marine licence id format is invalid', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: '/public/marine-licence/not-a-valid-id/generate-coordinates-csv'
    })

    expect(response.statusCode).toBe(400)
  })

  test('returns 403 when the marine licence is a draft', async () => {
    await insertSubmittedMarineLicence({
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(403)
  })

  test('returns 200 when the marine licence is active', async () => {
    await insertSubmittedMarineLicence({
      status: MARINE_LICENCE_STATUS.ACTIVE
    })

    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
  })
})
