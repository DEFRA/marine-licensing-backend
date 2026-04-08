import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

describe('PATCH /marine-licence/public-register - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  test('successfully updates public register when user consents', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId,
      publicRegister: { consent: 'no', reason: 'Previous reason' }
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      consent: 'yes'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-register',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.publicRegister).toEqual({
      consent: 'yes',
      reason: null
    })
  })

  test('successfully updates public register when user declines consent with reason', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId,
      publicRegister: { consent: 'yes' }
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      consent: 'no',
      reason: 'Reason why this should not be published'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-register',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.publicRegister).toEqual({
      consent: 'no',
      reason: 'Reason why this should not be published'
    })
  })

  test('returns 404 when marine licence does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      consent: 'no',
      reason: 'Some reason'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-register',
      contactId,
      payload
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId,
      publicRegister: { consent: 'yes' }
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      consent: 'yes'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-register',
      contactId: differentContactId,
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')

    const unchangedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(unchangedLicence.publicRegister.consent).toBe('yes')
  })

  test('returns 400 when consent is missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString()
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-register',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('PUBLIC_REGISTER_CONSENT_REQUIRED')
  })
})
