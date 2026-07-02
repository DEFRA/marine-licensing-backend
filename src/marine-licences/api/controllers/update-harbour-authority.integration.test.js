import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

describe('PATCH /marine-licence/harbour-authority - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  const marineLicenceId = new ObjectId()

  test('successfully updates harbour authority', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      harbourArea: 'yes',
      details: 'Harbour authority details'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/harbour-authority',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.harbourAuthority).toEqual({
      harbourArea: 'yes',
      details: 'Harbour authority details'
    })
  })

  test('returns 404 when marine licence does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      harbourArea: 'yes',
      details: 'Harbour authority details'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/harbour-authority',
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
      harbourArea: 'yes',
      details: 'Harbour authority details'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/harbour-authority',
      contactId: differentContactId,
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')
  })

  test('returns 400 when harbourArea is missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      details: 'Harbour authority details'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/harbour-authority',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('HARBOUR_AUTHORITY_REQUIRED.')
  })

  test('returns 400 when details are missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      harbourArea: 'yes'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/harbour-authority',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('HARBOUR_AUTHORITY_DETAILS_REQUIRED')
  })
})
