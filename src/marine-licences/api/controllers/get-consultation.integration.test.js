import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { randomUUID } from 'node:crypto'

describe('GET /marine-licence/consultation/{id} - integration tests', async () => {
  const getServer = await setupTestServer()
  const relationshipId = randomUUID()
  const consulteeOrgId = randomUUID()
  const otherOrgId = randomUUID()

  const consultee = (organisationId) => ({
    organisationId,
    consultationType: 'REQUEST_FOR_ADVICE',
    consultationStatus: 'RESPONSE_NEEDED'
  })

  const getConsultation = (id) =>
    makeGetRequest({
      server: getServer(),
      url: `/marine-licence/consultation/${id}`,
      contactId: randomUUID(),
      relationships: [
        `${relationshipId}:${consulteeOrgId}:Consultee Org:0:Employee:0`
      ],
      roles: [`${relationshipId}:Consultee:3`],
      currentRelationshipId: relationshipId
    })

  test('returns the consultation for a licence the organisation is consulted on', async () => {
    const marineLicenceId = new ObjectId()

    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne(
      createCompleteMarineLicence({
        _id: marineLicenceId,
        applicationReference: 'MLA/2026/00001',
        consultationRequests: [
          {
            consultationStartDate: '2026-06-01T00:00:00.000Z',
            consultees: [consultee(otherOrgId)]
          },
          {
            consultationStartDate: '2026-03-01T00:00:00.000Z',
            consultees: [consultee(otherOrgId), consultee(consulteeOrgId)]
          }
        ]
      })
    )

    const { statusCode, body } = await getConsultation(
      marineLicenceId.toString()
    )

    expect(statusCode).toBe(200)
    expect(body.consultation).toEqual({
      id: marineLicenceId.toString(),
      projectName: 'Test Marine Licence Project',
      applicationReference: 'MLA/2026/00001',
      consultationType: 'REQUEST_FOR_ADVICE',
      consultationStatus: 'RESPONSE_NEEDED',
      consultationStartDate: '2026-03-01T00:00:00.000Z'
    })
  })

  test('returns 404 when the organisation is not consulted on the licence', async () => {
    const marineLicenceId = new ObjectId()

    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne(
      createCompleteMarineLicence({
        _id: marineLicenceId,
        consultationRequests: [
          {
            consultationStartDate: '2026-03-01T00:00:00.000Z',
            consultees: [consultee(otherOrgId)]
          }
        ]
      })
    )

    const { statusCode } = await getConsultation(marineLicenceId.toString())

    expect(statusCode).toBe(404)
  })
})
