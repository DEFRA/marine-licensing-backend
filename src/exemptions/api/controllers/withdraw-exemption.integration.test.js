import { setupTestServer } from '../../../../tests/test-server.js'
import { makePostRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'

describe('Withdraw exemption - integration tests', async () => {
  const getServer = await setupTestServer()
  const exemptionId = new ObjectId()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'

  test('successfully withdraws a submitted exemption when requested by the owner', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId,
      status: EXEMPTION_STATUS.SUBMITTED
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: `/exemption/${exemptionId}/withdraw`,
      contactId,
      payload: {}
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({
      withdrawnAt: expect.any(String)
    })

    const withdrawnExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })
    expect(withdrawnExemption.status).toBe(EXEMPTION_STATUS.WITHDRAWN)
    expect(withdrawnExemption.withdrawnAt).toBeDefined()
    expect(withdrawnExemption.updatedAt).toBeDefined()
    expect(withdrawnExemption.updatedBy).toBe(contactId)
  })

  test('returns 404 when attempting to withdraw a non-existent exemption', async () => {
    const nonExistentId = new ObjectId()

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: `/exemption/${nonExistentId}/withdraw`,
      contactId,
      payload: {}
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to withdraw an exemption owned by another user', async () => {
    const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId,
      status: EXEMPTION_STATUS.SUBMITTED
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: `/exemption/${exemptionId}/withdraw`,
      contactId: differentContactId,
      payload: {}
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorized to request this resource')

    const stillSubmittedExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })
    expect(stillSubmittedExemption.status).toBe(EXEMPTION_STATUS.SUBMITTED)
    expect(stillSubmittedExemption.withdrawnAt).toBeUndefined()
  })
})
