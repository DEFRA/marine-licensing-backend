import { setupTestServer } from '../../../../../tests/test-server.js'
import { makePostRequest } from '../../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../../models/test-fixtures.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'

describe('POST /marine-licence/add-site-notice-evidence - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  const mockPayload = { id: marineLicenceId.toString() }

  const seedMarineLicence = () =>
    globalThis.mockMongo.collection(collectionMarineLicences).insertOne({
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId
    })

  test('successfully adds a site notice evidence entry', async () => {
    await seedMarineLicence()
    const requestedAt = new Date()

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/add-site-notice-evidence',
      contactId,
      payload: mockPayload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updated.siteNoticeEvidence).toEqual([{}])
    expect(updated.updatedBy).toBe(contactId)
    expect(updated.updatedAt).toBeInstanceOf(Date)
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      requestedAt.getTime()
    )
    expect(updated.updatedAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  test('returns 409 and does not add an entry once 30 already exist', async () => {
    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne({
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId,
      siteNoticeEvidence: Array.from({ length: 30 }, () => ({}))
    })

    const { statusCode } = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/add-site-notice-evidence',
      contactId,
      payload: mockPayload
    })

    expect(statusCode).toBe(409)

    const updated = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updated.siteNoticeEvidence).toHaveLength(30)
  })

  test('returns 404 when marine licence does not exist', async () => {
    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/add-site-notice-evidence',
      contactId,
      payload: { id: new ObjectId().toString() }
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    await seedMarineLicence()

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/add-site-notice-evidence',
      contactId: differentContactId,
      payload: mockPayload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')
  })
})
