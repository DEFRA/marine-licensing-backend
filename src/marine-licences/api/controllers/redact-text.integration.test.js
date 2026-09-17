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

  const redact = ({
    id = marineLicenceId.toString(),
    isInternalUser = true,
    ...payload
  }) =>
    makePostRequest({
      server: getServer(),
      url: '/marine-licence/redact-text',
      contactId: caseworkerOid,
      isInternalUser,
      payload: {
        id,
        fieldKey: 'preferredDates',
        text: mockRedactions.preferredDates.redactedText,
        ...payload
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

  test('removes a redaction and leaves the underlying field', async () => {
    await insertLicence()
    await redact({})

    const { statusCode } = await redact({ text: undefined, remove: true })

    expect(statusCode).toBe(200)

    const licence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(licence.redactions.preferredDates).toBeUndefined()
    expect(licence.preferredDates).toEqual(
      createCompleteMarineLicence({}).preferredDates
    )
  })

  test('attempting to remove a redaction that was never there does not error', async () => {
    await insertLicence()

    const { statusCode } = await redact({ text: undefined, remove: true })

    expect(statusCode).toBe(200)
  })

  test('stores a marine plan policy redaction against its code', async () => {
    await insertLicence()

    const { statusCode } = await redact({
      fieldKey: 'marinePlanPolicyResponses',
      policyCode: 'E-AGG-3'
    })

    expect(statusCode).toBe(200)

    const licence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(
      licence.redactions.marinePlanPolicyResponses['E-AGG-3'].redactedText
    ).toBe(mockRedactions.preferredDates.redactedText)
  })

  test('withholds the water framework directive document', async () => {
    await insertLicence()

    const { statusCode } = await redact({
      fieldKey: 'waterFrameworkDirective.withholdDocument',
      text: undefined,
      withhold: true
    })

    expect(statusCode).toBe(200)

    const licence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(licence.redactions.waterFrameworkDirective.withholdDocument).toEqual(
      {
        redactedAt: expect.any(Date),
        redactedBy: caseworkerOid,
        withhold: true
      }
    )
    expect(licence.waterFrameworkDirective).toEqual(
      createCompleteMarineLicence({}).waterFrameworkDirective
    )
  })

  test('withholds a construction drawing against its site and drawing', async () => {
    await insertLicence()

    const { statusCode } = await redact({
      fieldKey: 'siteDetails.constructionDrawings.withholdDocument',
      siteIndex: 0,
      drawingIndex: 0,
      text: undefined,
      withhold: true
    })

    expect(statusCode).toBe(200)

    const licence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(
      licence.redactions.siteDetails[0].constructionDrawings[0].withholdDocument
    ).toEqual({
      redactedAt: expect.any(Date),
      redactedBy: caseworkerOid,
      withhold: true
    })
    expect(licence.siteDetails).toEqual(
      createCompleteMarineLicence({}).siteDetails
    )
  })

  test('reverses a withheld document to false', async () => {
    await insertLicence()

    const withholdWfd = (withhold) =>
      redact({
        fieldKey: 'waterFrameworkDirective.withholdDocument',
        text: undefined,
        withhold
      })

    await withholdWfd(true)
    const { statusCode } = await withholdWfd(false)

    expect(statusCode).toBe(200)

    const licence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(
      licence.redactions.waterFrameworkDirective.withholdDocument.withhold
    ).toBe(false)
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
