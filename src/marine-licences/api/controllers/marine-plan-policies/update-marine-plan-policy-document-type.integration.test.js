import { setupTestServer } from '../../../../../tests/test-server.js'
import {
  findMarineLicence,
  insertMarineLicence
} from '../../../../../tests/test-helpers.js'
import { makePatchRequest } from '../../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'

const documentId = '123e4567-e89b-12d3-a456-426614174000'

describe('PATCH /marine-licence/marine-plan-policy-document-type - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  const buildPayload = (overrides = {}) => ({
    id: marineLicenceId.toString(),
    documentId,
    documentType: 'ecological-assessment',
    ...overrides
  })

  test('persists the document type on the matched document', async () => {
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyDocuments: [{ documentId }]
    })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document-type',
      contactId,
      payload: buildPayload()
    })

    expect(statusCode).toBe(200)
    expect(body.message).toBe('success')

    const updatedLicence = await findMarineLicence(marineLicenceId)

    expect(updatedLicence.marinePlanPolicyDocuments[0].documentType).toBe(
      'ecological-assessment'
    )
  })

  test('sets documentTypeOther and unsets it when switching away from other', async () => {
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyDocuments: [
        { documentId, documentTypeOther: 'previously other' }
      ]
    })

    await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document-type',
      contactId,
      payload: buildPayload({
        documentType: 'other',
        documentTypeOther: 'reason'
      })
    })

    let updatedLicence = await findMarineLicence(marineLicenceId)
    expect(updatedLicence.marinePlanPolicyDocuments[0].documentType).toBe(
      'other'
    )
    expect(updatedLicence.marinePlanPolicyDocuments[0].documentTypeOther).toBe(
      'reason'
    )

    // Switch away from 'other' - documentTypeOther is cleared
    await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document-type',
      contactId,
      payload: buildPayload()
    })

    updatedLicence = await findMarineLicence(marineLicenceId)
    expect(updatedLicence.marinePlanPolicyDocuments[0].documentType).toBe(
      'ecological-assessment'
    )
    expect(
      updatedLicence.marinePlanPolicyDocuments[0].documentTypeOther
    ).toBeUndefined()
  })

  test('returns 404 when the documentId does not match', async () => {
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyDocuments: [{ documentId: 'non-existent-doc-id' }]
    })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document-type',
      contactId,
      payload: buildPayload()
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Marine licence or document not found')
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyDocuments: [{ documentId }]
    })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document-type',
      contactId: differentContactId,
      payload: buildPayload()
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')
  })
})
