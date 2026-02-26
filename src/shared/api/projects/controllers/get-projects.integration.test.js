import { setupTestServer } from '../../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../../tests/server-requests.js'
import {
  createCompleteExemption,
  createCompleteMarineLicence
} from '../../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../../../../exemptions/constants/exemption.js'
import { MARINE_LICENCE_STATUS } from '../../../../marine-licences/constants/marine-licence.js'
import {
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'
import { PROJECT_TYPES } from '../../../constants/project-status.js'

vi.mock('../../../common/helpers/dynamics/get-contact-details.js', () => ({
  batchGetContactNames: vi.fn().mockResolvedValue({})
}))

describe('Get projects - integration tests', async () => {
  const getServer = await setupTestServer()

  describe('Individual/Citizen user (no organisation)', () => {
    test('returns combined list of exemptions and marine licences for citizen user', async () => {
      const exemptionId1 = new ObjectId()
      const exemptionId2 = new ObjectId()
      const marineLicenceId = new ObjectId()

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
      const marineLicence = createCompleteMarineLicence({
        _id: marineLicenceId,
        organisation: undefined,
        status: MARINE_LICENCE_STATUS.DRAFT
      })

      await globalThis.mockMongo
        .collection(collectionExemptions)
        .insertMany([exemption1, exemption2])
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .insertOne(marineLicence)

      const { statusCode, body, isEmployee } = await makeGetRequest({
        server: getServer(),
        url: '/projects',
        contactId: exemption1.contactId
      })

      expect(statusCode).toBe(200)
      expect(isEmployee).toBe(false)
      expect(body).toHaveLength(3)

      body.forEach((project) => {
        expect(project).toHaveProperty('projectType')
        expect(Object.values(PROJECT_TYPES)).toContain(project.projectType)
        expect(project).toHaveProperty('id')
        expect(project).toHaveProperty('status')
        expect(project).toHaveProperty('projectName')
      })

      const exemptionProjects = body.filter(
        (p) => p.projectType === PROJECT_TYPES.EXEMPTION
      )
      expect(exemptionProjects).toHaveLength(2)

      const marineLicenceProjects = body.filter(
        (p) => p.projectType === PROJECT_TYPES.MARINE_LICENCE
      )
      expect(marineLicenceProjects).toHaveLength(1)
      expect(marineLicenceProjects[0].projectName).toBe(
        marineLicence.projectName
      )
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

    test('returns all organisation projects from both collections for employee user', async () => {
      const exemptionId = new ObjectId()
      const marineLicenceId = new ObjectId()

      const myExemption = createCompleteExemption({
        _id: exemptionId,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'My Exemption',
        status: EXEMPTION_STATUS.DRAFT
      })

      const colleagueMarineLicence = createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId: colleagueContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Colleague Marine Licence',
        status: MARINE_LICENCE_STATUS.ACTIVE
      })

      await globalThis.mockMongo
        .collection(collectionExemptions)
        .insertOne(myExemption)
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .insertOne(colleagueMarineLicence)

      const { statusCode, body, isEmployee, organisationId } =
        await makeGetRequest({
          server: getServer(),
          url: '/projects',
          contactId: employeeContactId,
          relationships: employeeRelationships,
          currentRelationshipId: relationshipId
        })

      expect(statusCode).toBe(200)
      expect(isEmployee).toBe(true)
      expect(organisationId).toBe(testOrgId)
      expect(body).toHaveLength(2)

      const myProject = body.find((e) => e.projectName === 'My Exemption')
      expect(myProject.projectType).toBe(PROJECT_TYPES.EXEMPTION)
      expect(myProject.isOwnProject).toBe(true)
      expect(myProject.contactId).toBe(employeeContactId)

      const colleagueProject = body.find(
        (e) => e.projectName === 'Colleague Marine Licence'
      )
      expect(colleagueProject.projectType).toBe(PROJECT_TYPES.MARINE_LICENCE)
      expect(colleagueProject.isOwnProject).toBe(false)
      expect(colleagueProject.contactId).toBe(colleagueContactId)
    })

    test('returns only organisation projects, not other orgs', async () => {
      const exemptionId = new ObjectId()
      const marineLicenceId = new ObjectId()
      const otherOrgId = 'different-org-id'

      const orgExemption = createCompleteExemption({
        _id: exemptionId,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Org Exemption',
        status: EXEMPTION_STATUS.DRAFT
      })

      const otherOrgMarineLicence = createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId: employeeContactId,
        organisation: { id: otherOrgId, name: 'Other Org' },
        projectName: 'Other Org ML',
        status: MARINE_LICENCE_STATUS.DRAFT
      })

      await globalThis.mockMongo
        .collection(collectionExemptions)
        .insertOne(orgExemption)
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .insertOne(otherOrgMarineLicence)

      const { statusCode, body } = await makeGetRequest({
        server: getServer(),
        url: '/projects',
        contactId: employeeContactId,
        relationships: employeeRelationships,
        currentRelationshipId: relationshipId
      })

      expect(statusCode).toBe(200)
      expect(body).toHaveLength(1)
      expect(body[0].projectName).toBe('Org Exemption')
    })

    test('returns empty array when no projects exist for organisation', async () => {
      const { statusCode, body, isEmployee } = await makeGetRequest({
        server: getServer(),
        url: '/projects',
        contactId: employeeContactId,
        relationships: employeeRelationships,
        currentRelationshipId: relationshipId
      })

      expect(statusCode).toBe(200)
      expect(isEmployee).toBe(true)
      expect(body).toHaveLength(0)
    })

    test('sorts projects by status (Draft first, then Active)', async () => {
      const exemptionId1 = new ObjectId()
      const exemptionId2 = new ObjectId()
      const marineLicenceId = new ObjectId()

      const activeExemption = createCompleteExemption({
        _id: exemptionId1,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Active Exemption',
        status: EXEMPTION_STATUS.ACTIVE
      })

      const draftMarineLicence = createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Draft ML',
        status: MARINE_LICENCE_STATUS.DRAFT
      })

      const anotherActiveExemption = createCompleteExemption({
        _id: exemptionId2,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Another Active',
        status: EXEMPTION_STATUS.ACTIVE
      })

      await globalThis.mockMongo
        .collection(collectionExemptions)
        .insertMany([activeExemption, anotherActiveExemption])
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .insertOne(draftMarineLicence)

      const { body } = await makeGetRequest({
        server: getServer(),
        url: '/projects',
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

    test('returns only own projects, not colleague projects', async () => {
      const exemptionId = new ObjectId()
      const marineLicenceId = new ObjectId()

      const myExemption = createCompleteExemption({
        _id: exemptionId,
        contactId: agentContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'My Agent Exemption',
        status: EXEMPTION_STATUS.DRAFT
      })

      const colleagueMarineLicence = createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId: colleagueContactId,
        organisation: { id: testOrgId, name: 'Test Org' },
        projectName: 'Colleague ML',
        status: MARINE_LICENCE_STATUS.ACTIVE
      })

      await globalThis.mockMongo
        .collection(collectionExemptions)
        .insertOne(myExemption)
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .insertOne(colleagueMarineLicence)

      const { statusCode, body, isEmployee } = await makeGetRequest({
        server: getServer(),
        url: '/projects',
        contactId: agentContactId,
        relationships: agentRelationships,
        currentRelationshipId: relationshipId
      })

      expect(statusCode).toBe(200)
      expect(isEmployee).toBe(false)
      expect(body).toHaveLength(1)
      expect(body[0].projectName).toBe('My Agent Exemption')
    })
  })
})
