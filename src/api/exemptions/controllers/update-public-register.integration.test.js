import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionExemptions } from '../../../common/constants/db-collections.js'

describe('PATCH /exemption/public-register - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const exemptionId = new ObjectId()

  test('successfully updates public register when user consents', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId,
      publicRegister: { consent: 'no', reason: 'Previous reason' }
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const payload = {
      id: exemptionId.toString(),
      consent: 'yes'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/exemption/public-register',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({ message: 'success' })

    // Verify the exemption was updated in the database
    const updatedExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })

    expect(updatedExemption.publicRegister).toEqual({
      consent: 'yes',
      reason: null
    })
  })

  test('successfully updates public register when user declines with reason', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId,
      publicRegister: { consent: 'yes' }
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const payload = {
      id: exemptionId.toString(),
      consent: 'no',
      reason: 'Privacy concerns about publishing this information'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/exemption/public-register',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({ message: 'success' })

    // Verify the exemption was updated in the database
    const updatedExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })

    expect(updatedExemption.publicRegister).toEqual({
      consent: 'no',
      reason: 'Privacy concerns about publishing this information'
    })
  })

  test('returns 404 when exemption does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      consent: 'yes'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/exemption/public-register',
      contactId,
      payload
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to update another users exemption', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId,
      publicRegister: { consent: 'yes' }
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const payload = {
      id: exemptionId.toString(),
      consent: 'no',
      reason: 'Malicious update'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/exemption/public-register',
      contactId: differentContactId,
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorized to request this resource')

    // Verify the exemption was NOT updated
    const unchangedExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })

    expect(unchangedExemption.publicRegister.consent).toBe('yes')
  })

  test('returns 400 when consent is missing', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const payload = {
      id: exemptionId.toString()
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/exemption/public-register',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('PUBLIC_REGISTER_CONSENT_REQUIRED')
  })
})
