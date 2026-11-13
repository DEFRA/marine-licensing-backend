import { setupTestServer } from '../../../../../tests/test-server.js'
import {
  findMarineLicence,
  insertMarineLicence
} from '../../../../../tests/test-helpers.js'
import { makePostRequest } from '../../../../../tests/server-requests.js'
import {
  mockLinkedMarinePlanPolicyDocument,
  mockMarinePlanPolicyDocument
} from '../../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'

vi.mock('../../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    validateFileSize: vi.fn().mockResolvedValue({
      contentType: 'application/pdf'
    })
  }
}))

describe('POST /marine-licence/marine-plan-policy-document - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  const buildPayload = (overrides = {}) => ({
    id: marineLicenceId.toString(),
    ...mockMarinePlanPolicyDocument,
    ...overrides
  })

  test('successfully adds a document and returns a documentId', async () => {
    await insertMarineLicence({ _id: marineLicenceId, contactId })

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document',
      contactId,
      payload: buildPayload()
    })

    expect(statusCode).toBe(200)

    const updatedLicence = await findMarineLicence(marineLicenceId)

    expect(updatedLicence.marinePlanPolicyDocuments).toHaveLength(2)
    expect(updatedLicence.marinePlanPolicyDocuments[0]).toEqual(
      mockLinkedMarinePlanPolicyDocument
    )
    expect(updatedLicence.marinePlanPolicyDocuments[1]).toMatchObject({
      documentId: body.documentId,
      uploadedFile: mockMarinePlanPolicyDocument.uploadedFile,
      s3Location: mockMarinePlanPolicyDocument.s3Location
    })
  })

  test('a second upload appends to the array', async () => {
    await insertMarineLicence({ _id: marineLicenceId, contactId })

    const first = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document',
      contactId,
      payload: buildPayload()
    })
    const second = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document',
      contactId,
      payload: buildPayload()
    })

    expect(first.body.documentId).not.toBe(second.body.documentId)

    const updatedLicence = await findMarineLicence(marineLicenceId)

    expect(updatedLicence.marinePlanPolicyDocuments).toHaveLength(3)
  })

  test('returns 404 when the marine licence does not exist', async () => {
    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document',
      contactId,
      payload: { ...buildPayload(), id: new ObjectId().toString() }
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to add to another users marine licence', async () => {
    await insertMarineLicence({ _id: marineLicenceId, contactId })

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-document',
      contactId: differentContactId,
      payload: buildPayload()
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')

    const unchangedLicence = await findMarineLicence(marineLicenceId)

    expect(unchangedLicence.marinePlanPolicyDocuments).toEqual([
      mockLinkedMarinePlanPolicyDocument
    ])
  })
})
