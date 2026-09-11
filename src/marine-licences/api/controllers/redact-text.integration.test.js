import { setupTestServer } from '../../../../tests/test-server.js'
import { makePostRequest } from '../../../../tests/server-requests.js'
import {
  createCompleteMarineLicence,
  mockRedactions
} from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

describe('POST /marine-licence/redact-text - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const caseworkerOid = '987e6543-e21b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  const insertLicence = () =>
    globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(
        createCompleteMarineLicence({ _id: marineLicenceId, contactId })
      )

  const redact = ({ id = marineLicenceId.toString(), isInternalUser = true }) =>
    makePostRequest({
      server: getServer(),
      url: '/marine-licence/redact-text',
      contactId: caseworkerOid,
      isInternalUser,
      payload: {
        id,
        fieldKey: 'preferredDates',
        text: mockRedactions.preferredDates.redactedText
      }
    })

  test('stores a redaction without touching the underlying field', async () => {
    await insertLicence()

    const { statusCode, body } = await redact({})

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const licence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(licence.redactions.preferredDates).toEqual({
      ...mockRedactions.preferredDates,
      redactedAt: expect.any(Date),
      redactedBy: caseworkerOid
    })
    expect(licence.preferredDates).toEqual(
      createCompleteMarineLicence({}).preferredDates
    )
  })

  test('overwrites an existing redaction for the same field', async () => {
    await insertLicence()
    await redact({})

    const { statusCode } = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/redact-text',
      contactId: caseworkerOid,
      isInternalUser: true,
      payload: {
        id: marineLicenceId.toString(),
        fieldKey: 'preferredDates',
        text: 'Redacted again'
      }
    })

    expect(statusCode).toBe(200)

    const licence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(licence.redactions.preferredDates.redactedText).toBe(
      'Redacted again'
    )
  })

  test('returns 403 for a non Entra ID user', async () => {
    await insertLicence()

    const { statusCode, body } = await redact({ isInternalUser: false })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to redact data')
  })

  test('returns 404 when the marine licence does not exist', async () => {
    const { statusCode, body } = await redact({ id: new ObjectId().toString() })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Marine licence not found')
  })
})
