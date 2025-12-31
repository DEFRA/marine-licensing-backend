import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'

describe('PATCH /exemption/project-name - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const exemptionId = new ObjectId()

  test('successfully updates project name when requested by owner', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId,
      projectName: 'Original Project Name'
    })
    await globalThis.mockMongo.collection('exemptions').insertOne(exemption)

    const payload = {
      id: exemptionId.toString(),
      projectName: 'Updated Project Name'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/exemption/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({ message: 'success' })

    // Verify the exemption was updated in the database
    const updatedExemption = await globalThis.mockMongo
      .collection('exemptions')
      .findOne({ _id: exemptionId })

    expect(updatedExemption.projectName).toBe('Updated Project Name')
  })

  test('returns 404 when exemption does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      projectName: 'Updated Project Name'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/exemption/project-name',
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
      projectName: 'Original Project Name'
    })
    await globalThis.mockMongo.collection('exemptions').insertOne(exemption)

    const payload = {
      id: exemptionId.toString(),
      projectName: 'Malicious Update'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/exemption/project-name',
      contactId: differentContactId,
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorized to request this resource')

    // Verify the exemption was NOT updated
    const unchangedExemption = await globalThis.mockMongo
      .collection('exemptions')
      .findOne({ _id: exemptionId })

    expect(unchangedExemption.projectName).toBe('Original Project Name')
  })

  test('returns 400 when projectName is missing', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      contactId
    })
    await globalThis.mockMongo.collection('exemptions').insertOne(exemption)

    const payload = {
      id: exemptionId.toString()
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/exemption/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('PROJECT_NAME_REQUIRED')
  })
})
