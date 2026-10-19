import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { randomUUID } from 'node:crypto'

describe('GET /marine-licence/consultations - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = randomUUID()
  const relationshipId = randomUUID()
  const consulteeOrgId = randomUUID()
  const otherOrgId = randomUUID()

  const consultee = (organisationId) => ({
    organisationId,
    consultationType: 'APPLICATION_NOTIFICATION',
    consultationStatus: 'NO_RESPONSE_NEEDED',
    notes: `Notes for ${organisationId}`
  })

  const getConsultations = (relationshipType) =>
    makeGetRequest({
      server: getServer(),
      url: '/marine-licence/consultations',
      contactId,
      relationships: [
        `${relationshipId}:${consulteeOrgId}:Consultee Org:0:${relationshipType}:0`
      ],
      currentRelationshipId: relationshipId
    })

  test('returns one row per licence with its matching consultation, latest start date first', async () => {
    const olderForOrg = new ObjectId()
    const newerForOrg = new ObjectId()

    await globalThis.mockMongo.collection(collectionMarineLicences).insertMany([
      createCompleteMarineLicence({
        _id: olderForOrg,
        applicationReference: 'MLA/2026/00001',
        consultationRequests: [
          {
            consultationStartDate: '2026-01-01T00:00:00.000Z',
            consultees: [consultee(consulteeOrgId), consultee(otherOrgId)]
          },
          {
            consultationStartDate: '2026-06-01T00:00:00.000Z',
            consultees: [consultee(otherOrgId)]
          }
        ]
      }),
      createCompleteMarineLicence({
        _id: newerForOrg,
        applicationReference: 'MLA/2026/00002',
        consultationRequests: [
          {
            consultationStartDate: '2026-03-01T00:00:00.000Z',
            consultees: [consultee(consulteeOrgId)]
          }
        ]
      }),
      createCompleteMarineLicence({
        consultationRequests: [
          {
            consultationStartDate: '2026-09-01T00:00:00.000Z',
            consultees: [consultee(otherOrgId)]
          }
        ]
      }),
      createCompleteMarineLicence()
    ])

    const { statusCode, body } = await getConsultations('Consultee')

    expect(statusCode).toBe(200)
    expect(body.consultations).toEqual([
      {
        id: newerForOrg.toString(),
        projectName: 'Test Marine Licence Project',
        applicationReference: 'MLA/2026/00002',
        consultationType: 'APPLICATION_NOTIFICATION',
        consultationStatus: 'NO_RESPONSE_NEEDED',
        consultationStartDate: '2026-03-01T00:00:00.000Z'
      },
      {
        id: olderForOrg.toString(),
        projectName: 'Test Marine Licence Project',
        applicationReference: 'MLA/2026/00001',
        consultationType: 'APPLICATION_NOTIFICATION',
        consultationStatus: 'NO_RESPONSE_NEEDED',
        consultationStartDate: '2026-01-01T00:00:00.000Z'
      }
    ])
  })

  test('returns 403 when the user is not signed in as a consultee', async () => {
    const { statusCode } = await getConsultations('Employee')

    expect(statusCode).toBe(403)
  })
})
