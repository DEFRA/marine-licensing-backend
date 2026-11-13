import { setupTestServer } from '../../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { MAS_CONSULTATION_STATUS } from '../../../constants/marine-licence.js'

describe('PATCH /marine-licence/update-consultation-request - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = randomUUID()
  const relationshipId = randomUUID()
  const consulteeOrgId = randomUUID()
  const otherOrgId = randomUUID()
  const marineLicenceId = new ObjectId()
  const response = 'We have no objections'

  const consultee = (organisationId) => ({
    organisationId,
    consultationType: 'REQUEST_FOR_ADVICE',
    consultationStatus: 'RESPONSE_NEEDED'
  })

  const seedMarineLicence = (consultationRequests) =>
    globalThis.mockMongo.collection(collectionMarineLicences).insertOne(
      createCompleteMarineLicence({
        _id: marineLicenceId,
        consultationRequests
      })
    )

  const findMarineLicence = () =>
    globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

  const updateConsultationRequest = ({ role = 'Consultee:3' } = {}) =>
    makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-consultation-request',
      contactId,
      payload: { id: marineLicenceId.toString(), response },
      relationships: [
        `${relationshipId}:${consulteeOrgId}:Consultee Org:0:Employee:0`
      ],
      roles: [`${relationshipId}:${role}`],
      currentRelationshipId: relationshipId
    })

  test('sets the response on the consultee for the users organisation only', async () => {
    await seedMarineLicence([
      {
        consultationStartDate: '2026-06-01T00:00:00.000Z',
        consultees: [consultee(otherOrgId)]
      },
      {
        consultationStartDate: '2026-03-01T00:00:00.000Z',
        consultees: [consultee(otherOrgId), consultee(consulteeOrgId)]
      }
    ])
    const requestedAt = new Date()

    const { statusCode, body } = await updateConsultationRequest()

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await findMarineLicence()

    expect(updated.consultationRequests).toEqual([
      {
        consultationStartDate: '2026-06-01T00:00:00.000Z',
        consultees: [consultee(otherOrgId)]
      },
      {
        consultationStartDate: '2026-03-01T00:00:00.000Z',
        consultees: [
          consultee(otherOrgId),
          {
            ...consultee(consulteeOrgId),
            consultationStatus: 'RESPONDED',
            response
          }
        ]
      }
    ])
    expect(updated.updatedBy).toBe(contactId)
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      requestedAt.getTime()
    )
    expect(updated.updatedAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  test('returns 404 when the organisation is not consulted on the licence', async () => {
    await seedMarineLicence([
      {
        consultationStartDate: '2026-03-01T00:00:00.000Z',
        consultees: [consultee(otherOrgId)]
      }
    ])

    const { statusCode } = await updateConsultationRequest()

    expect(statusCode).toBe(404)
  })

  test('accepts a response when the consultee status is NO_RESPONSE_NEEDED', async () => {
    const notified = {
      ...consultee(consulteeOrgId),
      consultationType: 'APPLICATION_NOTIFICATION',
      consultationStatus: MAS_CONSULTATION_STATUS.NO_RESPONSE_NEEDED
    }
    await seedMarineLicence([
      {
        consultationStartDate: '2026-03-01T00:00:00.000Z',
        consultees: [consultee(otherOrgId), notified]
      }
    ])

    const { statusCode } = await updateConsultationRequest()

    expect(statusCode).toBe(200)

    const updated = await findMarineLicence()

    expect(updated.consultationRequests[0].consultees).toEqual([
      consultee(otherOrgId),
      {
        ...notified,
        consultationStatus: MAS_CONSULTATION_STATUS.RESPONDED,
        response
      }
    ])
  })

  test('returns 409 and leaves the consultee unchanged when it has already responded', async () => {
    const existing = {
      ...consultee(consulteeOrgId),
      consultationStatus: MAS_CONSULTATION_STATUS.RESPONDED,
      response: 'Earlier response'
    }
    await seedMarineLicence([
      {
        consultationStartDate: '2026-03-01T00:00:00.000Z',
        consultees: [consultee(otherOrgId), existing]
      }
    ])

    const { statusCode, body } = await updateConsultationRequest()

    expect(statusCode).toBe(409)
    expect(body.message).toBe(
      `Consultation in Marine Licence ${marineLicenceId} has already been responded to`
    )

    const updated = await findMarineLicence()

    expect(updated.consultationRequests[0].consultees[1]).toEqual(existing)
  })

  test('returns 403 when the user does not have an approved Consultee role', async () => {
    await seedMarineLicence([
      {
        consultationStartDate: '2026-03-01T00:00:00.000Z',
        consultees: [consultee(consulteeOrgId)]
      }
    ])

    const { statusCode } = await updateConsultationRequest({
      role: 'Consultee:1'
    })

    expect(statusCode).toBe(403)

    const updated = await findMarineLicence()

    expect(updated.consultationRequests[0].consultees[0]).not.toHaveProperty(
      'response'
    )
  })
})
