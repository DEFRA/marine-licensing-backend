import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'

describe('PATCH /marine-licence/project-background - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  test('successfully updates project background when requested by owner', async () => {
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      projectBackground: 'Some background information about the project'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/project-background',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({ message: 'success' })

    const updatedMarineLicence = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: marineLicenceId })

    expect(updatedMarineLicence.projectBackground).toBe(
      'Some background information about the project'
    )
  })

  test('returns 404 when marine licence does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      projectBackground: 'Some background information about the project'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/project-background',
      contactId,
      payload
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId,
      projectBackground: 'Original background'
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      projectBackground: 'Malicious update'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/project-background',
      contactId: '987e6543-e21b-12d3-a456-426614174000',
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')

    const unchangedMarineLicence = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: marineLicenceId })

    expect(unchangedMarineLicence.projectBackground).toBe('Original background')
  })
})
