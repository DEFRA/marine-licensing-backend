import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { collectionExemptions } from '../../../common/constants/db-collections.js'

vi.mock('../../../common/helpers/dynamics/get-contact-details.js', () => ({
  batchGetContactNames: vi.fn().mockResolvedValue({})
}))

describe('Get exemptions - integration tests', async () => {
  const getServer = await setupTestServer()

  describe('Individual/Citizen user (no organisation)', () => {
    test('returns a list of exemptions for citizen user', async () => {
      const exemptionId1 = new ObjectId()
      const exemptionId2 = new ObjectId()
      const exemption1 = createCompleteExemption({
        _id: exemptionId1,
        organisation: null,
        status: EXEMPTION_STATUS.ACTIVE
      })
      const exemption2 = createCompleteExemption({
        _id: exemptionId2,
        organisation: null,
        status: EXEMPTION_STATUS.DRAFT
      })
      const exemptions = [exemption1, exemption2]
      await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertMany(exemptions)

      const { statusCode, body, isEmployee } = await makeGetRequest({
        server: getServer(),
        url: '/exemptions',
        contactId: exemption1.contactId
      })
      expect(statusCode).toBe(200)
      expect(isEmployee).toBe(false)
      expect(body).toHaveLength(exemptions.length)
      body.forEach((exemption) => {
        const dbExemption = exemptions.find(
          ({ _id }) => _id.toString() === exemption.id
        )
        expect(exemption).toEqual({
          id: dbExemption._id.toString(),
          status:
            dbExemption.status === EXEMPTION_STATUS.DRAFT ? 'Draft' : 'Active',
          projectName: dbExemption.projectName
        })
      })
    })
  })

  describe('Employee user', () => {
    const testOrgId = '27d48d6c-6e94-f011-b4cc-000d3ac28f39'
    const relationshipId = '81d48d6c-6e94-f011-b4cc-000d3ac28f39'
    const employeeContactId = '123e4567-e89b-12d3-a456-426614174001'
    const colleagueContactId = '123e4567-e89b-12d3-a456-426614174002'

    const employeeRelationships = [
      `${relationshipId}:${testOrgId}:Test Org:0:Employee:0`
    ]

    test('returns all organisation exemptions for employee user', async () => {
      const exemptionId1 = new ObjectId()
      const exemptionId2 = new ObjectId()

      const myExemption = createCompleteExemption({
        _id: exemptionId1,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'My Project',
        status: EXEMPTION_STATUS.DRAFT
      })

      const colleagueExemption = createCompleteExemption({
        _id: exemptionId2,
        contactId: colleagueContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Colleague Project',
        status: EXEMPTION_STATUS.ACTIVE
      })

      await globalThis.mockMongo
        .collection('exemptions')
        .insertMany([myExemption, colleagueExemption])

      const { statusCode, body, isEmployee, organisationId } =
        await makeGetRequest({
          server: getServer(),
          url: '/exemptions',
          contactId: employeeContactId,
          relationships: employeeRelationships,
          currentRelationshipId: relationshipId
        })

      expect(statusCode).toBe(200)
      expect(isEmployee).toBe(true)
      expect(organisationId).toBe(testOrgId)
      expect(body).toHaveLength(2)

      const myProject = body.find((e) => e.projectName === 'My Project')
      expect(myProject.isOwnProject).toBe(true)
      expect(myProject.contactId).toBe(employeeContactId)

      const colleagueProject = body.find(
        (e) => e.projectName === 'Colleague Project'
      )
      expect(colleagueProject.isOwnProject).toBe(false)
      expect(colleagueProject.contactId).toBe(colleagueContactId)
    })

    test('returns only organisation exemptions, not other orgs', async () => {
      const exemptionId1 = new ObjectId()
      const exemptionId2 = new ObjectId()
      const otherOrgId = 'different-org-id'

      const orgExemption = createCompleteExemption({
        _id: exemptionId1,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Org Project',
        status: EXEMPTION_STATUS.DRAFT
      })

      const otherOrgExemption = createCompleteExemption({
        _id: exemptionId2,
        contactId: employeeContactId,
        organisation: { id: otherOrgId, name: 'Other Org' },
        projectName: 'Other Org Project',
        status: EXEMPTION_STATUS.DRAFT
      })

      await globalThis.mockMongo
        .collection('exemptions')
        .insertMany([orgExemption, otherOrgExemption])

      const { statusCode, body } = await makeGetRequest({
        server: getServer(),
        url: '/exemptions',
        contactId: employeeContactId,
        relationships: employeeRelationships,
        currentRelationshipId: relationshipId
      })

      expect(statusCode).toBe(200)
      expect(body).toHaveLength(1)
      expect(body[0].projectName).toBe('Org Project')
    })

    test('returns empty array when no exemptions exist for organisation', async () => {
      const { statusCode, body, isEmployee } = await makeGetRequest({
        server: getServer(),
        url: '/exemptions',
        contactId: employeeContactId,
        relationships: employeeRelationships,
        currentRelationshipId: relationshipId
      })

      expect(statusCode).toBe(200)
      expect(isEmployee).toBe(true)
      expect(body).toHaveLength(0)
    })

    test('sorts exemptions by status (Draft first, then Active)', async () => {
      const exemptionId1 = new ObjectId()
      const exemptionId2 = new ObjectId()
      const exemptionId3 = new ObjectId()

      const activeExemption = createCompleteExemption({
        _id: exemptionId1,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Active Project',
        status: EXEMPTION_STATUS.ACTIVE
      })

      const draftExemption = createCompleteExemption({
        _id: exemptionId2,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Draft Project',
        status: EXEMPTION_STATUS.DRAFT
      })

      const anotherActiveExemption = createCompleteExemption({
        _id: exemptionId3,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Another Active',
        status: EXEMPTION_STATUS.ACTIVE
      })

      await globalThis.mockMongo
        .collection('exemptions')
        .insertMany([activeExemption, draftExemption, anotherActiveExemption])

      const { body } = await makeGetRequest({
        server: getServer(),
        url: '/exemptions',
        contactId: employeeContactId,
        relationships: employeeRelationships,
        currentRelationshipId: relationshipId
      })

      expect(body[0].status).toBe('Draft')
      expect(body[1].status).toBe('Active')
      expect(body[2].status).toBe('Active')
    })
  })

  describe('Agent user (non-employee organisation user)', () => {
    const testOrgId = '27d48d6c-6e94-f011-b4cc-000d3ac28f39'
    const relationshipId = '81d48d6c-6e94-f011-b4cc-000d3ac28f39'
    const agentContactId = '123e4567-e89b-12d3-a456-426614174003'
    const colleagueContactId = '123e4567-e89b-12d3-a456-426614174004'

    const agentRelationships = [
      `${relationshipId}:${testOrgId}:Test Org:0:Agent:0`
    ]

    test('returns only own exemptions, not colleague exemptions', async () => {
      const exemptionId1 = new ObjectId()
      const exemptionId2 = new ObjectId()

      const myExemption = createCompleteExemption({
        _id: exemptionId1,
        contactId: agentContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'My Agent Project',
        status: EXEMPTION_STATUS.DRAFT
      })

      const colleagueExemption = createCompleteExemption({
        _id: exemptionId2,
        contactId: colleagueContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Colleague Project',
        status: EXEMPTION_STATUS.ACTIVE
      })

      await globalThis.mockMongo
        .collection('exemptions')
        .insertMany([myExemption, colleagueExemption])

      const { statusCode, body, isEmployee } = await makeGetRequest({
        server: getServer(),
        url: '/exemptions',
        contactId: agentContactId,
        relationships: agentRelationships,
        currentRelationshipId: relationshipId
      })

      expect(statusCode).toBe(200)
      expect(isEmployee).toBe(false)
      expect(body).toHaveLength(1)
      expect(body[0].projectName).toBe('My Agent Project')
    })
  })
})
