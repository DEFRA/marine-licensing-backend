import { setupTestServer } from '../../../../tests/test-server.js'
import { makePostRequest } from '../../../../tests/server-requests.js'
import { MARINE_LICENSE_STATUS } from '../../constants/marine-license.js'

describe('Create project name - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const organisationId = 'org-123'
  const organisationName = 'Test Organisation'

  test('successfully creates without organisation', async () => {
    const payload = {
      projectName: 'Test Project',
      userRelationshipType: 'Citizen',
      mcmsContext: {
        iatQueryString: 'test-query-string'
      }
    }

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-license/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)

    // Verify the marine license was created in the database with correct fields
    const createdMarineLicense = await globalThis.mockMongo
      .collection('marine-licenses')
      .findOne({ projectName: 'Test Project' })

    expect(body.id).toBe(createdMarineLicense._id.toString())
    expect(createdMarineLicense.status).toBe(MARINE_LICENSE_STATUS.DRAFT)
    expect(createdMarineLicense.contactId).toBe(contactId)
    expect(createdMarineLicense.projectName).toBe('Test Project')
    expect(createdMarineLicense.mcmsContext).toEqual({
      iatQueryString: 'test-query-string'
    })
    expect(createdMarineLicense.organisation).toBeUndefined()
  })

  test('successfully creates with organisation', async () => {
    const payload = {
      projectName: 'Test Project with Org',
      organisationId,
      organisationName,
      userRelationshipType: 'Employee',
      mcmsContext: {
        iatQueryString: 'test-query-string'
      }
    }

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-license/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({
      id: expect.any(String)
    })

    // Verify the marine license was created with organisation details
    const createdMarineLicense = await globalThis.mockMongo
      .collection('marine-licenses')
      .findOne({ projectName: 'Test Project with Org' })

    expect(createdMarineLicense).not.toBeNull()
    expect(createdMarineLicense.organisation).toEqual({
      id: organisationId,
      name: organisationName,
      userRelationshipType: 'Employee'
    })
  })

  test('successfully creates with valid mcmsContext', async () => {
    const payload = {
      projectName: 'Test Project',
      userRelationshipType: 'Citizen',
      mcmsContext: {
        iatQueryString: 'test-query-string',
        sessionId: 'session-123',
        correlationId: 'correlation-123',
        journey: 'test-journey'
      }
    }

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-license/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({
      id: expect.any(String)
    })

    // Verify mcmsContext was stored correctly (fallback to iatQueryString only due to invalid fields)
    const createdMarineLicense = await globalThis.mockMongo
      .collection('marine-licenses')
      .findOne({ projectName: 'Test Project' })

    expect(createdMarineLicense.mcmsContext).toEqual({
      iatQueryString: 'test-query-string'
    })
  })

  test('handles invalid mcmsContext by storing only iatQueryString', async () => {
    const payload = {
      projectName: 'Test Project Invalid MCMS',
      userRelationshipType: 'Citizen',
      mcmsContext: {
        iatQueryString: 'test-query-string',
        invalidField: 'should-not-be-stored'
      }
    }

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-license/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({
      id: expect.any(String)
    })

    // Verify only iatQueryString was stored when validation fails
    const createdMarineLicense = await globalThis.mockMongo
      .collection('marine-licenses')
      .findOne({ projectName: 'Test Project Invalid MCMS' })

    expect(createdMarineLicense.mcmsContext).toEqual({
      iatQueryString: 'test-query-string'
    })
  })
})
