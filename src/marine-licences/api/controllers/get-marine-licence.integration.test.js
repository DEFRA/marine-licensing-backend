import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import {
  MARINE_LICENCE_STATUS,
  MARINE_LICENCE_STATUS_LABEL
} from '../../constants/marine-licence.js'
import Wreck from '@hapi/wreck'

vi.mock('../../../shared/common/helpers/dynamics/get-access-token.js', () => ({
  getDynamicsAccessToken: vi.fn().mockResolvedValue('abc')
}))
vi.mock('@hapi/wreck')

const mockDynamicsContactDetailsApi = () => {
  vi.mocked(Wreck.get).mockResolvedValue({
    payload: Buffer.from(JSON.stringify({ fullname: 'Dave Barnett' }))
  })
}

describe('Get marine licence - integration tests', async () => {
  process.env.DYNAMICS_API_URL = 'test'
  process.env.DYNAMICS_ENABLED = true
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()

  test('requested by user who created the marine licence', async () => {
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      organisation: null
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}`,
      contactId: marineLicence.contactId
    })
    expect(statusCode).toBe(200)

    const { _id, preferredDates, ...rest } = marineLicence
    expect(body).toEqual({
      ...rest,
      id: _id.toString(),
      applicationTasks: [],
      status: MARINE_LICENCE_STATUS_LABEL[marineLicence.status],
      createdAt: marineLicence.createdAt.toISOString(),
      updatedAt: marineLicence.updatedAt.toISOString(),
      preferredDates,
      marinePlanPolicyJob: null,
      marinePlanPolicies: [],
      marinePlanPolicyResponses: {},
      marinePlanPolicyResponseCount: 0,
      siteDetailsDataComplete: false,
      taskList: {
        feeEstimate: 'INCOMPLETE',
        harbourAuthority: 'INCOMPLETE',
        invoicing: 'INCOMPLETE',
        projectName: 'COMPLETED',
        otherAuthorities: 'INCOMPLETE',
        preferredDates: 'COMPLETED',
        projectBackground: 'INCOMPLETE',
        publicConsultation: 'INCOMPLETE',
        publicRegister: 'COMPLETED',
        siteDetails: 'INCOMPLETE',
        waterFrameworkDirective: 'INCOMPLETE',
        marinePlanPolicies: 'INCOMPLETE'
      }
    })

    expect(body.whoMarineLicenceIsFor).toBeUndefined()
  })

  test('includes who the marine licence is for when the creator requests a submitted licence', async () => {
    const submittedId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: submittedId,
      contactId: '9687cdd5-49e7-4508-b56c-08a4d02c43c2',
      status: MARINE_LICENCE_STATUS.SUBMITTED,
      organisation: null
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)
    mockDynamicsContactDetailsApi()

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/marine-licence/${submittedId}`,
      contactId: marineLicence.contactId
    })

    expect(statusCode).toBe(200)
    expect(body.whoMarineLicenceIsFor).toBe('Dave Barnett')
  })

  describe('requested by an organisation member who did not create it', () => {
    const organisationId = '27d48d6c-6e94-f011-b4cc-000d3ac28f39'
    const currentRelationshipId = '81d48d6c-6e94-f011-b4cc-000d3ac28f39'
    const colleagueContactId = 'b1a2c3d4-0000-4000-8000-000000000001'
    const relationshipsFor = (orgId, relationshipType = 'Employee') => [
      `${currentRelationshipId}:${orgId}:Dredging Co:0:${relationshipType}:0`
    ]

    const insertOrgLicence = async () => {
      const id = new ObjectId()
      await globalThis.mockMongo.collection('marine-licences').insertOne({
        ...mockMarineLicence,
        _id: id,
        organisation: {
          id: organisationId,
          name: 'Dredging Co',
          userRelationshipType: 'Employee'
        }
      })
      return id
    }

    test('returns the licence to a colleague in the same organisation', async () => {
      const id = await insertOrgLicence()

      const { statusCode, body } = await makeGetRequest({
        server: getServer(),
        url: `/marine-licence/${id}`,
        contactId: colleagueContactId,
        currentRelationshipId,
        relationships: relationshipsFor(organisationId)
      })

      expect(statusCode).toBe(200)
      expect(body.id).toBe(id.toString())
      expect(body.contactId).toBe(mockMarineLicence.contactId)
    })

    test('returns 403 to an employee of a different organisation', async () => {
      const id = await insertOrgLicence()

      const { statusCode } = await makeGetRequest({
        server: getServer(),
        url: `/marine-licence/${id}`,
        contactId: colleagueContactId,
        currentRelationshipId,
        relationships: relationshipsFor('another-org-id')
      })

      expect(statusCode).toBe(403)
    })

    test('returns the licence to a consultee in the same organisation', async () => {
      const id = await insertOrgLicence()

      const { statusCode, body } = await makeGetRequest({
        server: getServer(),
        url: `/marine-licence/${id}`,
        contactId: colleagueContactId,
        currentRelationshipId,
        relationships: relationshipsFor(organisationId, 'Consultee')
      })

      expect(statusCode).toBe(200)
      expect(body.id).toBe(id.toString())
    })
  })

  test('requested by a public user', async () => {
    const publicId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: publicId,
      contactId: '9687cdd5-49e7-4508-b56c-08a4d02c43c2',
      status: MARINE_LICENCE_STATUS.SUBMITTED,
      organisation: null
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)
    mockDynamicsContactDetailsApi()

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/public/marine-licence/${publicId}`
    })
    expect(statusCode).toBe(200)

    const { _id, preferredDates, ...rest } = marineLicence
    expect(body).toEqual({
      ...rest,
      id: _id.toString(),
      status: MARINE_LICENCE_STATUS_LABEL[marineLicence.status],
      createdAt: marineLicence.createdAt.toISOString(),
      updatedAt: marineLicence.updatedAt.toISOString(),
      preferredDates,
      whoMarineLicenceIsFor: 'Dave Barnett',
      marinePlanPolicyJob: null,
      marinePlanPolicies: [],
      marinePlanPolicyResponses: {},
      marinePlanPolicyResponseCount: 0,
      siteDetailsDataComplete: false,
      taskList: {
        feeEstimate: 'INCOMPLETE',
        harbourAuthority: 'INCOMPLETE',
        invoicing: 'INCOMPLETE',
        projectName: 'COMPLETED',
        otherAuthorities: 'INCOMPLETE',
        preferredDates: 'COMPLETED',
        projectBackground: 'INCOMPLETE',
        siteDetails: 'INCOMPLETE',
        publicRegister: 'COMPLETED',
        publicConsultation: 'INCOMPLETE',
        waterFrameworkDirective: 'INCOMPLETE',
        marinePlanPolicies: 'INCOMPLETE'
      }
    })
  })

  test('shows a public user Submitted while action is required, without the application tasks', async () => {
    const actionRequiredId = new ObjectId()

    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: actionRequiredId,
      organisation: null,
      status: MARINE_LICENCE_STATUS.ACTION_REQUIRED,
      previousStatus: MARINE_LICENCE_STATUS.SUBMITTED,
      applicationTasks: [
        {
          taskId: new ObjectId().toHexString(),
          type: 'WITHHOLDING_NOTIFICATION',
          resolvedAt: null,
          data: { commercialConfidentiality: { applicantMessage: 'Private' } }
        }
      ]
    })
    mockDynamicsContactDetailsApi()

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/public/marine-licence/${actionRequiredId}`
    })

    expect(statusCode).toBe(200)
    expect(body.status).toBe(MARINE_LICENCE_STATUS_LABEL.SUBMITTED)
    expect(body).not.toHaveProperty('applicationTasks')
    expect(body).not.toHaveProperty('previousStatus')
    expect(JSON.stringify(body)).not.toContain('Private')
  })

  test('returns 403 when public user requests a non SUBMITTED marine licence', async () => {
    const draftId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: draftId,
      status: MARINE_LICENCE_STATUS.DRAFT
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const server = getServer()
    const response = await server.inject({
      method: 'GET',
      url: `/public/marine-licence/${draftId}`
    })

    expect(response.statusCode).toBe(403)
  })
})
