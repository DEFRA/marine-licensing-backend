import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicense } from '../../../models/marine-licenses/test-fixtures.js'

describe('PATCH /marine-license/project-name - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const marineLicenseId = new ObjectId()

  test('successfully updates project name when requested by owner', async () => {
    const marineLicense = {
      ...mockMarineLicense,
      _id: marineLicenseId,
      contactId,
      projectName: 'Original Project Name'
    }

    await globalThis.mockMongo
      .collection('marine-licenses')
      .insertOne(marineLicense)

    const payload = {
      id: marineLicenseId.toString(),
      projectName: 'Updated Project Name'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-license/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({ message: 'success' })

    const updatedMarineLicense = await globalThis.mockMongo
      .collection('marine-licenses')
      .findOne({ _id: marineLicenseId })

    expect(updatedMarineLicense.projectName).toBe('Updated Project Name')
  })

  test('returns 404 when marine license does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      projectName: 'Updated Project Name'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-license/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to update another users marine license', async () => {
    const marineLicense = {
      ...mockMarineLicense,
      _id: marineLicenseId,
      contactId,
      projectName: 'Original Project Name'
    }

    await globalThis.mockMongo
      .collection('marine-licenses')
      .insertOne(marineLicense)

    const payload = {
      id: marineLicenseId.toString(),
      projectName: 'Malicious Update'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-license/project-name',
      contactId: '987e6543-e21b-12d3-a456-426614174000',
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorized to request this resource')

    const unchangedMarineLicense = await globalThis.mockMongo
      .collection('marine-licenses')
      .findOne({ _id: marineLicenseId })

    expect(unchangedMarineLicense.projectName).toBe('Original Project Name')
  })

  test('returns 400 when projectName is missing', async () => {
    const marineLicense = {
      ...mockMarineLicense,
      _id: marineLicenseId,
      contactId
    }

    await globalThis.mockMongo
      .collection('marine-licenses')
      .insertOne(marineLicense)

    const payload = {
      id: marineLicenseId.toString()
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-license/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('PROJECT_NAME_REQUIRED')
  })
})
