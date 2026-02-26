import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'

describe('PATCH /marine-licence/project-name - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  test('successfully updates project name when requested by owner', async () => {
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId,
      projectName: 'Original Project Name'
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      projectName: 'Updated Project Name'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({ message: 'success' })

    const updatedmarineLicence = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: marineLicenceId })

    expect(updatedmarineLicence.projectName).toBe('Updated Project Name')
  })

  test('returns 404 when marine licence does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      projectName: 'Updated Project Name'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/project-name',
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
      projectName: 'Original Project Name'
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      projectName: 'Malicious Update'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/project-name',
      contactId: '987e6543-e21b-12d3-a456-426614174000',
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorized to request this resource')

    const unchangedMarineLicence = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: marineLicenceId })

    expect(unchangedMarineLicence.projectName).toBe('Original Project Name')
  })

  test('returns 400 when projectName is missing', async () => {
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString()
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('PROJECT_NAME_REQUIRED')
  })
})
