import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

describe('PATCH /marine-licence/fee-estimate - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  const marineLicenceId = new ObjectId()

  test('successfully updates fee estimate', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      accept: 'yes',
      termsAndConditions: true,
      feeBand: '2A'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/fee-estimate',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.feeEstimate).toEqual({
      accept: 'yes',
      termsAndConditions: true,
      feeBand: '2A'
    })
  })

  test('returns 404 when marine licence does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      accept: 'yes',
      termsAndConditions: true,
      feeBand: '2A'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/fee-estimate',
      contactId,
      payload
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })

    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      accept: 'yes',
      termsAndConditions: true,
      feeBand: '2A'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/fee-estimate',
      contactId: differentContactId,
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')
  })

  test('returns 400 when accept is missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      termsAndConditions: true
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/fee-estimate',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('FEE_ESTIMATE_ACCEPT_REQUIRED')
  })

  test('returns 400 when terms and conditions are missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      accept: 'yes'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/fee-estimate',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('FEE_ESTIMATE_TERMS_AND_CONDITIONS_REQUIRED')
  })
})
