import { setupTestServer } from '../../../../tests/test-server.js'
import { makeDeleteRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'

describe('Delete marine licence - integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  beforeEach(async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId,
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)
  })

  test('successfully deletes a draft marine licence when requested by the owner', async () => {
    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}`,
      contactId
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'Marine licence deleted successfully' })

    const deletedMarineLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })
    expect(deletedMarineLicence).toBeNull()
  })

  test('returns 404 when attempting to delete a non-existent marine licence', async () => {
    const nonExistentId = new ObjectId()

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-licence/${nonExistentId}`,
      contactId
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 400 when attempting to delete an active marine licence', async () => {
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOneAndUpdate(
        { _id: marineLicenceId },
        { $set: { status: MARINE_LICENCE_STATUS.ACTIVE } }
      )

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}`,
      contactId
    })

    expect(statusCode).toBe(400)
    expect(body.message).toBe(
      `Cannot delete marine licence as marine licence must be the status '${MARINE_LICENCE_STATUS.DRAFT}'.`
    )

    const stillExistingMarineLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })
    expect(stillExistingMarineLicence).not.toBeNull()
  })

  test('returns 403 when attempting to delete a marine licence owned by another user', async () => {
    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}`,
      contactId: differentContactId
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorized to request this resource')

    const stillExistingMarineLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })
    expect(stillExistingMarineLicence).not.toBeNull()
  })
})
