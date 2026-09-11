import { setupTestServer } from '../../../../../tests/test-server.js'
import { makePostRequest } from '../../../../../tests/server-requests.js'
import {
  createCompleteExemption,
  createCompleteMarineLicence
} from '../../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import {
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'
import { randomUUID } from 'node:crypto'

vi.mock('../../../common/helpers/dynamics/get-contact-details.js', () => ({
  batchGetContactNames: vi.fn((contactIds) =>
    Promise.resolve(
      Object.fromEntries(contactIds.map((id) => [id, `Name for ${id}`]))
    )
  )
}))

describe('Get users (batch resolve) - integration tests', async () => {
  const getServer = await setupTestServer()

  describe('Employee user', () => {
    const testOrgId = randomUUID()
    const relationshipId = randomUUID()
    const employeeContactId = randomUUID()
    const colleagueContactId = randomUUID()
    const otherOrgContactId = randomUUID()

    const employeeRelationships = [
      `${relationshipId}:${testOrgId}:Test Org:0:Employee:0`
    ]

    test('resolves only ids that belong to the caller organisation', async () => {
      const exemptionId = new ObjectId()
      const marineLicenceId = new ObjectId()
      const otherOrgExemptionId = new ObjectId()

      const myExemption = createCompleteExemption({
        _id: exemptionId,
        contactId: employeeContactId,
        organisation: { id: testOrgId, name: 'Test Org' }
      })

      const colleagueMarineLicence = createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId: colleagueContactId,
        organisation: { id: testOrgId, name: 'Test Org' }
      })

      const otherOrgExemption = createCompleteExemption({
        _id: otherOrgExemptionId,
        contactId: otherOrgContactId,
        organisation: { id: 'different-org-id', name: 'Other Org' }
      })

      await globalThis.mockMongo
        .collection(collectionExemptions)
        .insertMany([myExemption, otherOrgExemption])
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .insertOne(colleagueMarineLicence)

      const { statusCode, body } = await makePostRequest({
        server: getServer(),
        url: '/projects/users',
        payload: {
          contactIds: [colleagueContactId, otherOrgContactId]
        },
        contactId: employeeContactId,
        relationships: employeeRelationships,
        currentRelationshipId: relationshipId
      })

      expect(statusCode).toBe(200)
      expect(body).toEqual({
        [colleagueContactId]: `Name for ${colleagueContactId}`
      })
    })

    test('rejects an empty contactIds array', async () => {
      const { statusCode } = await makePostRequest({
        server: getServer(),
        url: '/projects/users',
        payload: { contactIds: [] },
        contactId: employeeContactId,
        relationships: employeeRelationships,
        currentRelationshipId: relationshipId
      })

      expect(statusCode).toBe(400)
    })

    test('rejects a non-uuid contactId', async () => {
      const { statusCode } = await makePostRequest({
        server: getServer(),
        url: '/projects/users',
        payload: { contactIds: ['not-a-uuid'] },
        contactId: employeeContactId,
        relationships: employeeRelationships,
        currentRelationshipId: relationshipId
      })

      expect(statusCode).toBe(400)
    })
  })

  describe('Individual/Citizen user (no organisation)', () => {
    test('throws a 403 when calling this without an org id', async () => {
      const citizenContactId = randomUUID()
      const someContactId = randomUUID()

      const { statusCode, body } = await makePostRequest({
        server: getServer(),
        url: '/projects/users',
        payload: { contactIds: [someContactId] },
        contactId: citizenContactId
      })

      expect(statusCode).toBe(403)
      expect(body.message).toBe(
        'Not authorised to get user names for this organisation'
      )
    })
  })
})
