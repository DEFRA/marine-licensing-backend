import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import AdmZip from 'adm-zip'
import { setupTestServer } from '../../../../tests/test-server.js'
import {
  createCompleteMarineLicence,
  mockCircleSite
} from '../../../../tests/test.fixture.js'

vi.mock('adm-zip', () => ({
  default: vi.fn(function () {})
}))

// TODO: mockFileUploadSite (tests/test.fixture.js) uses a Point geometry,
// but the geo-parser rejects Point/MultiPoint/LineString/MultiLineString on
// upload (see validateFeatureGeometryTypes in geo-parser.js) - a 'file' site
// can never really have one. That makes createCompleteMarineLicence()'s
// default siteDetails unrealistic for CSV generation, which crashes trying
// to convert it. Using mockCircleSite here for now - fix the shared fixture
// to use a Polygon geometry instead, then drop this override.
describe('Generate coordinates CSV - integration tests', async () => {
  const getServer = await setupTestServer()
  const mockMarineLicence = createCompleteMarineLicence({
    siteDetails: [mockCircleSite]
  })
  const contactId = mockMarineLicence.contactId

  const addFile = vi.fn()

  beforeEach(() => {
    addFile.mockClear()
    AdmZip.mockImplementation(function () {
      return { addFile, toBuffer: vi.fn(() => Buffer.from('zip-bytes')) }
    })
  })

  const csvFromLastZip = () => addFile.mock.calls[0][1].toString()

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
    expect(response.headers['content-type']).toContain('application/zip')

    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="Download CSV.zip"'
    )

    const firstLine = csvFromLastZip().split('\n')[0]
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
          ],
          siteName: 'Test Site'
        }
      ]
    })

    const response = await injectAsEntraIdUser(
      getServer(),
      marineLicenceId.toString()
    )

    expect(response.statusCode).toBe(200)

    const lines = csvFromLastZip().split('\n').filter(Boolean)
    expect(lines).toHaveLength(4) // header + 2 coordinate rows + closing coordinate

    expect(lines[1]).toBe('51,30,0,6,1')
    expect(lines[2]).toBe('51,36,0,12,1')
    expect(lines[3]).toBe('51,30,0,6,1')
    expect(addFile).toHaveBeenCalledWith('Test Site.csv', expect.any(Buffer))
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
