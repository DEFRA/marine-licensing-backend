import { setupTestServer } from '../../../../tests/test-server.js'
import { makeDeleteRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicense } from '../../../../tests/test.fixture.js'
import { MARINE_LICENSE_STATUS } from '../../constants/marine-license.js'
import { collectionMarineLicenses } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'

describe('Delete marine license - integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenseId = new ObjectId()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  beforeEach(async () => {
    const marineLicense = createCompleteMarineLicense({
      _id: marineLicenseId,
      contactId,
      status: MARINE_LICENSE_STATUS.DRAFT
    })

    await globalThis.mockMongo
      .collection(collectionMarineLicenses)
      .insertOne(marineLicense)
  })

  test('successfully deletes a draft marine license when requested by the owner', async () => {
    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-license/${marineLicenseId}`,
      contactId
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'Marine license deleted successfully' })

    const deletedMarineLicense = await globalThis.mockMongo
      .collection(collectionMarineLicenses)
      .findOne({ _id: marineLicenseId })
    expect(deletedMarineLicense).toBeNull()
  })

  test('returns 404 when attempting to delete a non-existent marine license', async () => {
    const nonExistentId = new ObjectId()

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-license/${nonExistentId}`,
      contactId
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 400 when attempting to delete an active marine license', async () => {
    await globalThis.mockMongo
      .collection(collectionMarineLicenses)
      .findOneAndUpdate(
        { _id: marineLicenseId },
        { $set: { status: MARINE_LICENSE_STATUS.ACTIVE } }
      )

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-license/${marineLicenseId}`,
      contactId
    })

    expect(statusCode).toBe(400)
    expect(body.message).toBe(
      `Cannot delete marine license as marine license must be the status '${MARINE_LICENSE_STATUS.DRAFT}'.`
    )

    const stillExistingMarineLicense = await globalThis.mockMongo
      .collection(collectionMarineLicenses)
      .findOne({ _id: marineLicenseId })
    expect(stillExistingMarineLicense).not.toBeNull()
  })

  test('returns 403 when attempting to delete a marine license owned by another user', async () => {
    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-license/${marineLicenseId}`,
      contactId: differentContactId
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorized to request this resource')

    const stillExistingMarineLicense = await globalThis.mockMongo
      .collection(collectionMarineLicenses)
      .findOne({ _id: marineLicenseId })
    expect(stillExistingMarineLicense).not.toBeNull()
  })
})
