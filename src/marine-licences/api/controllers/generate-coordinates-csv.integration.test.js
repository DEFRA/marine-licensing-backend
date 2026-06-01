import { setupTestServer } from '../../../../tests/test-server.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'

describe('Generate coordinates CSV - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = mockMarineLicence.contactId

  const injectAsEntraIdUser = (server, id) =>
    server.inject({
      method: 'GET',
      url: `/marine-licence/${id}/generate-coordinates-csv`,
      auth: {
        strategy: 'jwt',
        credentials: { contactId },
        artifacts: { decoded: { tid: 'tenant-id' } }
      }
    })

  const injectAsDefraIdUser = (server, id) =>
    server.inject({
      method: 'GET',
      url: `/marine-licence/${id}/generate-coordinates-csv`,
      auth: {
        strategy: 'jwt',
        credentials: { contactId },
        artifacts: { decoded: {} }
      }
    })

  test('returns 200 with correct headers', async () => {
    const marineLicenceId = new ObjectId()
    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne({ ...mockMarineLicence, _id: marineLicenceId })

    const response = await injectAsEntraIdUser(
      getServer(),
      marineLicenceId.toString()
    )

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

  test('returns CSV rows for a polygon site', async () => {
    const marineLicenceId = new ObjectId()
    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: marineLicenceId,
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
      ]
    })

    const response = await injectAsEntraIdUser(
      getServer(),
      marineLicenceId.toString()
    )

    expect(response.statusCode).toBe(200)

    const lines = response.payload.split('\n').filter(Boolean)
    expect(lines).toHaveLength(3) // header + 2 coordinate rows

    expect(lines[1]).toBe('51,30,0,6,1')
    expect(lines[2]).toBe('51,36,0,12,1')
  })

  test('returns 403 for a non-Entra ID user', async () => {
    const marineLicenceId = new ObjectId()
    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne({ ...mockMarineLicence, _id: marineLicenceId })

    const response = await injectAsDefraIdUser(
      getServer(),
      marineLicenceId.toString()
    )

    expect(response.statusCode).toBe(403)
  })
})
