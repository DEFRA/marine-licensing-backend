import { setupTestServer } from '../../../../tests/test-server.js'
import { makeDeleteRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { collectionExemptions } from '../../../common/constants/db-collections.js'
import { ObjectId } from 'mongodb'

describe('Delete exemption - integration tests', async () => {
  const getServer = await setupTestServer()
  const exemptionId = new ObjectId()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  test('successfully deletes a draft exemption when requested by the owner', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId,
      status: EXEMPTION_STATUS.DRAFT
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/exemption/${exemptionId}`,
      contactId
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'Exemption deleted successfully' })

    // Verify the exemption was actually deleted from the database
    const deletedExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })
    expect(deletedExemption).toBeNull()
  })

  test('returns 404 when attempting to delete a non-existent exemption', async () => {
    const nonExistentId = new ObjectId()

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/exemption/${nonExistentId}`,
      contactId
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 400 when attempting to delete a submitted exemption', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId,
      status: EXEMPTION_STATUS.ACTIVE
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/exemption/${exemptionId}`,
      contactId
    })

    expect(statusCode).toBe(400)
    expect(body.message).toBe(
      `Cannot delete exemption as exemption must be the status '${EXEMPTION_STATUS.DRAFT}'.`
    )

    // Verify the exemption was NOT deleted from the database
    const stillExistingExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })
    expect(stillExistingExemption).not.toBeNull()
  })

  test('returns 403 when attempting to delete an exemption owned by another user', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId,
      status: EXEMPTION_STATUS.DRAFT
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/exemption/${exemptionId}`,
      contactId: differentContactId // Different user attempting to delete
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorized to request this resource')

    // Verify the exemption was NOT deleted from the database
    const stillExistingExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })
    expect(stillExistingExemption).not.toBeNull()
  })
})
