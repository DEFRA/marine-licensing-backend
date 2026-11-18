import { setupTestServer } from '../../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import {
  createCompleteMarineLicence,
  mockLinkedMarinePlanPolicyDocument
} from '../../../../../tests/test.fixture.js'
import { blobService } from '../../../../shared/services/data-service/blob-service.js'

vi.mock('../../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

describe('PATCH /marine-licence/delete-supporting-deocuments - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'

  test('successfully deletes a document', async () => {
    const licenceId = new ObjectId()
    const documentId = mockLinkedMarinePlanPolicyDocument.documentId

    const marineLicence = createCompleteMarineLicence({
      _id: licenceId,
      mockLinkedMarinePlanPolicyDocument
    })

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-marine-plan-policy-document',
      contactId,
      payload: { id: licenceId.toString(), documentId }
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: licenceId })

    expect(updated.marinePlanPolicyDocuments).toEqual([])
  })

  test('deletes every uploaded file for the site from S3, leaving other files untouched', async () => {
    const licenceId = new ObjectId()

    const documentId = mockLinkedMarinePlanPolicyDocument.documentId

    const marineLicence = createCompleteMarineLicence({
      _id: licenceId,
      mockLinkedMarinePlanPolicyDocument
    })

    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...marineLicence,
      _id: licenceId,
      contactId,
      marinePlanPolicyDocuments: [
        mockLinkedMarinePlanPolicyDocument,
        {
          uploadedFile: {
            filename: 'second-file.docx'
          },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key: `marine-licences/${licenceId}`,
            checksumSha256: 'V3nR8yISvb6pfVp1g1eUdFo5Cer80JpGlqkGAJb/O8k='
          }
        }
      ]
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-marine-plan-policy-document',
      contactId,
      payload: { id: licenceId, documentId }
    })

    expect(statusCode).toBe(200)
    expect(blobService.deleteFiles).toHaveBeenCalledWith([
      {
        s3Bucket: 'mmo-uploads',
        s3Key:
          'marine-licences/697ff02d-e5e7-4e42-ba47-c36fc116af47/45265950-72fb-4bb7-ab1c-2fb722ab15ec'
      }
    ])
  })

  test('returns 404 when licence Id is invalid', async () => {
    const licenceId = new ObjectId()
    const documentId = mockLinkedMarinePlanPolicyDocument.documentId

    const marineLicence = createCompleteMarineLicence()

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-marine-plan-policy-document',
      contactId,
      payload: { id: licenceId, documentId }
    })

    expect(statusCode).toBe(404)
  })

  test('returns 404 when document Id is invalid', async () => {
    const licenceId = new ObjectId()
    const documentId = mockLinkedMarinePlanPolicyDocument.documentId

    const marineLicence = createCompleteMarineLicence({
      _id: licenceId,
      marinePlanPolicyDocuments: [
        {
          ...mockLinkedMarinePlanPolicyDocument,
          documentId: new ObjectId()
        }
      ]
    })

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-marine-plan-policy-document',
      contactId,
      payload: { id: licenceId, documentId }
    })

    expect(statusCode).toBe(404)
  })
})
