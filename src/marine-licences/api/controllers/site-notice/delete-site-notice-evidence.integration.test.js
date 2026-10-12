import { setupTestServer } from '../../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../../models/test-fixtures.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'

describe('PATCH /marine-licence/delete-site-notice-evidence - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const url = '/marine-licence/delete-site-notice-evidence'

  const siteNoticeEvidence = [
    { locationName: 'North pier' },
    { locationName: 'South pier' },
    { locationName: 'Harbour wall' }
  ]

  const buildPayload = (evidenceIndex) => ({
    id: marineLicenceId.toString(),
    evidenceIndex
  })

  const seedMarineLicence = () =>
    globalThis.mockMongo.collection(collectionMarineLicences).insertOne({
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId,
      siteNoticeEvidence
    })

  const findMarineLicence = () =>
    globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

  test('successfully deletes the site notice evidence at the given index', async () => {
    await seedMarineLicence()
    const requestedAt = new Date()

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: buildPayload(1)
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await findMarineLicence()

    expect(updated.siteNoticeEvidence).toEqual([
      siteNoticeEvidence[0],
      siteNoticeEvidence[2]
    ])
    expect(updated.updatedBy).toBe(contactId)
    expect(updated.updatedAt).toBeInstanceOf(Date)
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      requestedAt.getTime()
    )
    expect(updated.updatedAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  test('returns 404 and leaves the array unchanged when evidenceIndex is out of range', async () => {
    await seedMarineLicence()

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: buildPayload(3)
    })

    expect(statusCode).toBe(404)

    const unchanged = await findMarineLicence()
    expect(unchanged.siteNoticeEvidence).toEqual(siteNoticeEvidence)
  })

  test('returns 400 when evidenceIndex is negative', async () => {
    await seedMarineLicence()

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: buildPayload(-1)
    })

    expect(statusCode).toBe(400)
  })

  test('returns 404 when marine licence does not exist', async () => {
    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: { id: new ObjectId().toString(), evidenceIndex: 0 }
    })

    expect(statusCode).toBe(404)
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    await seedMarineLicence()

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url,
      contactId: differentContactId,
      payload: buildPayload(0)
    })

    expect(statusCode).toBe(403)
  })
})
