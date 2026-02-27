import { setupTestServer } from '../../../../tests/test-server.js'
import { makePostRequest } from '../../../../tests/server-requests.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'

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
      url: '/marine-licence/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)

    // Verify the marine licence was created in the database with correct fields
    const createdMarineLicence = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ projectName: 'Test Project' })

    expect(body.id).toBe(createdMarineLicence._id.toString())
    expect(createdMarineLicence.status).toBe(MARINE_LICENCE_STATUS.DRAFT)
    expect(createdMarineLicence.contactId).toBe(contactId)
    expect(createdMarineLicence.projectName).toBe('Test Project')
    expect(createdMarineLicence.mcmsContext).toEqual({
      iatQueryString: 'test-query-string'
    })
    expect(createdMarineLicence.organisation).toBeUndefined()
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
      url: '/marine-licence/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({
      id: expect.any(String)
    })

    // Verify the marine licence was created with organisation details
    const createdMarineLicence = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ projectName: 'Test Project with Org' })

    expect(createdMarineLicence).not.toBeNull()
    expect(createdMarineLicence.organisation).toEqual({
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
      url: '/marine-licence/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({
      id: expect.any(String)
    })

    // Verify mcmsContext was stored correctly (fallback to iatQueryString only due to invalid fields)
    const createdMarineLicence = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ projectName: 'Test Project' })

    expect(createdMarineLicence.mcmsContext).toEqual({
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
      url: '/marine-licence/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({
      id: expect.any(String)
    })

    // Verify only iatQueryString was stored when validation fails
    const createdMarineLicence = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ projectName: 'Test Project Invalid MCMS' })

    expect(createdMarineLicence.mcmsContext).toEqual({
      iatQueryString: 'test-query-string'
    })
  })
})
