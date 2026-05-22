import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

describe('PATCH /marine-licence/public-consultation - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  test('successfully updates public consultation when consulted is no', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId,
      publicConsultation: { consulted: 'yes', details: 'Previous details' }
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      consulted: 'no'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-consultation',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.publicConsultation).toEqual({
      consulted: 'no',
      details: null
    })
  })

  test('successfully updates public consultation when consulted is yes with details', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId,
      publicConsultation: { consulted: 'no' }
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      consulted: 'yes',
      details: 'Details of the public consultation carried out'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-consultation',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.publicConsultation).toEqual({
      consulted: 'yes',
      details: 'Details of the public consultation carried out'
    })
  })

  test('returns 404 when marine licence does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      consulted: 'yes',
      details: 'Some details'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-consultation',
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
      publicConsultation: { consulted: 'no' }
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      consulted: 'no'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-consultation',
      contactId: differentContactId,
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')

    const unchangedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(unchangedLicence.publicConsultation.consulted).toBe('no')
  })

  test('returns 400 when consulted is missing', async () => {
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
      url: '/marine-licence/public-consultation',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('PUBLIC_CONSULTATION_REQUIRED')
  })

  test('returns 400 when consulted is yes but details are missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      consulted: 'yes'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/public-consultation',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('PUBLIC_CONSULTATION_DETAILS_REQUIRED')
  })
})
