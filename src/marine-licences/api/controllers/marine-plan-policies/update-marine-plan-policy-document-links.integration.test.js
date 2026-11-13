import { setupTestServer } from '../../../../../tests/test-server.js'
import {
  findMarineLicence,
  insertMarineLicence
} from '../../../../../tests/test-helpers.js'
import { makePatchRequest } from '../../../../../tests/server-requests.js'
import { mockLinkedMarinePlanPolicyDocument } from '../../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'

const { documentId, policyLinks: linkedPolicies } =
  mockLinkedMarinePlanPolicyDocument
const url = '/marine-licence/marine-plan-policy-document-links'

describe('PATCH /marine-licence/marine-plan-policy-document-links - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  const buildPayload = (policyLinks, overrides = {}) => ({
    id: marineLicenceId.toString(),
    documentId,
    policyLinks,
    ...overrides
  })

  test('replaces the links on the matched document only', async () => {
    const otherDocument = {
      documentId: 'other-doc',
      policyLinks: [{ policyCode: 'E-MPA-1', location: 'Page 1' }]
    }

    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyDocuments: [
        mockLinkedMarinePlanPolicyDocument,
        otherDocument
      ]
    })

    const policyLinks = [{ policyCode: 'E-BIO-1', location: 'Pages 12 to 15' }]
    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: buildPayload(policyLinks)
    })

    expect(statusCode).toBe(200)
    expect(body.message).toBe('success')

    const licence = await findMarineLicence(marineLicenceId)
    expect(licence.marinePlanPolicyDocuments).toEqual([
      { ...mockLinkedMarinePlanPolicyDocument, policyLinks },
      otherDocument
    ])
  })

  test('adds links to a document that has none yet', async () => {
    const { policyLinks, ...unlinkedDocument } =
      mockLinkedMarinePlanPolicyDocument
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyDocuments: [unlinkedDocument]
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: buildPayload(linkedPolicies)
    })

    const marineLicence = await findMarineLicence(marineLicenceId)

    expect(statusCode).toBe(200)
    expect(marineLicence.marinePlanPolicyDocuments).toEqual([
      mockLinkedMarinePlanPolicyDocument
    ])
  })

  test('returns 400 when the document has no type yet', async () => {
    const { documentType, policyLinks, ...untypedDocument } =
      mockLinkedMarinePlanPolicyDocument
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyDocuments: [untypedDocument]
    })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: buildPayload(linkedPolicies)
    })

    const marineLicence = await findMarineLicence(marineLicenceId)

    expect(statusCode).toBe(400)
    expect(body.message).toBe('DOCUMENT_TYPE_REQUIRED')
    expect(marineLicence.marinePlanPolicyDocuments).toEqual([untypedDocument])
  })

  test('returns 404 when the documentId does not match', async () => {
    await insertMarineLicence({ _id: marineLicenceId, contactId })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: buildPayload(linkedPolicies, {
        documentId: '123e4567-e89b-12d3-a456-426614174000'
      })
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Marine licence or document not found')
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    await insertMarineLicence({ _id: marineLicenceId, contactId })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url,
      contactId: differentContactId,
      payload: buildPayload(linkedPolicies)
    })

    const marineLicence = await findMarineLicence(marineLicenceId)

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')
    expect(marineLicence.marinePlanPolicyDocuments).toEqual([
      mockLinkedMarinePlanPolicyDocument
    ])
  })
})
