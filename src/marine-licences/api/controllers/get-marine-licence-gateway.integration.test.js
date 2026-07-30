import { setupTestServer } from '../../../../tests/test-server.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getPresignedUrl: vi.fn()
  }
}))

describe('GET /public/marine-licence/mas/{id} - integration tests', async () => {
  const getServer = await setupTestServer()

  test('returns project fields for a SUBMITTED marine licence', async () => {
    const publicId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: publicId,
      projectName: 'Harbour dredging',
      projectBackground: 'Maintenance of navigation channel',
      preferredDates: {
        start: { month: '08', year: '2026' },
        end: { month: '11', year: '2026' }
      },
      status: MARINE_LICENCE_STATUS.SUBMITTED
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const response = await getServer().inject({
      method: 'GET',
      url: `/public/marine-licence/mas/${publicId}`
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload)).toEqual({
      projectName: 'Harbour dredging',
      projectBackground: 'Maintenance of navigation channel',
      preferredLicenceDates: 'August 2026 to November 2026'
    })
  })

  test('returns 403 when requesting a DRAFT marine licence', async () => {
    const draftId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: draftId,
      status: MARINE_LICENCE_STATUS.DRAFT
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const response = await getServer().inject({
      method: 'GET',
      url: `/public/marine-licence/mas/${draftId}`
    })

    expect(response.statusCode).toBe(403)
  })

  test('returns 404 when marine licence does not exist', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: `/public/marine-licence/mas/${new ObjectId()}`
    })

    expect(response.statusCode).toBe(404)
  })
})
