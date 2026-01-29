import { setupTestServer } from '../../../../tests/test-server.js'
import { makePostRequest } from '../../../../tests/server-requests.js'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { collectionExemptions } from '../../../common/constants/db-collections.js'

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
      url: '/exemption/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)

    // Verify the exemption was created in the database with correct fields
    const createdExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ projectName: 'Test Project' })

    expect(body.id).toBe(createdExemption._id.toString())
    expect(createdExemption.status).toBe(EXEMPTION_STATUS.DRAFT)
    expect(createdExemption.contactId).toBe(contactId)
    expect(createdExemption.projectName).toBe('Test Project')
    expect(createdExemption.mcmsContext).toEqual({
      iatQueryString: 'test-query-string'
    })
    expect(createdExemption.organisation).toBeUndefined()
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
      url: '/exemption/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({
      id: expect.any(String)
    })

    // Verify the exemption was created with organisation details
    const createdExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ projectName: 'Test Project with Org' })

    expect(createdExemption).not.toBeNull()
    expect(createdExemption.organisation).toEqual({
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
      url: '/exemption/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({
      id: expect.any(String)
    })

    // Verify mcmsContext was stored correctly (fallback to iatQueryString only due to invalid fields)
    const createdExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ projectName: 'Test Project' })

    expect(createdExemption.mcmsContext).toEqual({
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
      url: '/exemption/project-name',
      contactId,
      payload
    })

    expect(statusCode).toBe(201)
    expect(body).toEqual({
      id: expect.any(String)
    })

    // Verify only iatQueryString was stored when validation fails
    const createdExemption = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ projectName: 'Test Project Invalid MCMS' })

    expect(createdExemption.mcmsContext).toEqual({
      iatQueryString: 'test-query-string'
    })
  })
})
