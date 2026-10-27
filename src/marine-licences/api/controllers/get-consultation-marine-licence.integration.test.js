import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { randomUUID } from 'node:crypto'

describe('GET /marine-licence/consultation/{id}/details - integration tests', async () => {
  const getServer = await setupTestServer()
  const relationshipId = randomUUID()
  const consulteeOrgId = randomUUID()
  const otherOrgId = randomUUID()

  const insertLicenceConsulting = async (organisationId) => {
    const id = new ObjectId()
    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne(
      createCompleteMarineLicence({
        _id: id,
        organisation: { id: otherOrgId, name: 'Dredging Co' },
        applicationTasks: [{ comment: 'Withholding comment' }],
        consultationRequests: [
          {
            consultationStartDate: '2026-03-01T00:00:00.000Z',
            consultees: [{ organisationId }]
          }
        ]
      })
    )
    return id.toString()
  }

  const getDetails = (id, roles = [`${relationshipId}:Consultee:3`]) =>
    makeGetRequest({
      server: getServer(),
      url: `/marine-licence/consultation/${id}/details`,
      contactId: randomUUID(),
      relationships: [
        `${relationshipId}:${consulteeOrgId}:Consultee Org:0:Employee:0`
      ],
      roles,
      currentRelationshipId: relationshipId
    })

  test('returns the licence to an organisation consulted on it, without application tasks', async () => {
    const id = await insertLicenceConsulting(consulteeOrgId)

    const { statusCode, body } = await getDetails(id)

    expect(statusCode).toBe(200)
    expect(body.id).toBe(id)
    expect(body.projectName).toBe('Test Marine Licence Project')
    expect(body.whoMarineLicenceIsFor).toBe('Dredging Co')
    expect(body.applicationTasks).toBeUndefined()
  })

  test('returns 404 when the organisation is not consulted on the licence', async () => {
    const id = await insertLicenceConsulting(otherOrgId)

    const { statusCode } = await getDetails(id)

    expect(statusCode).toBe(404)
  })

  test('returns 403 when the user does not have an approved Consultee role', async () => {
    const id = await insertLicenceConsulting(consulteeOrgId)

    const { statusCode } = await getDetails(id, [])

    expect(statusCode).toBe(403)
  })
})
