import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../../tests/server-requests.js'
import { mockLinkedMarinePlanPolicyDocument } from '../../../../../tests/test.fixture.js'
import {
  findMarineLicence,
  insertMarineLicence
} from '../../../../../tests/test-helpers.js'
import { blobService } from '../../../../shared/services/data-service/blob-service.js'
import { POLICY_CONSIDERATION_MIN_LENGTH } from '../../../models/marine-plan-policy.js'

vi.mock('../../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

describe('PATCH /marine-licence/marine-plan-policy-response - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const response = 'x'.repeat(POLICY_CONSIDERATION_MIN_LENGTH)

  test('stores the response and requiresDocumentation, counting only non-empty responses', async () => {
    const marineLicenceId = new ObjectId()
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyResponses: {
        'EXISTING-1': { response, requiresDocumentation: false },
        'EXISTING-2': { response: '', requiresDocumentation: false }
      },
      marinePlanPolicyResponseCount: 1
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-response',
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        policyCode: 'NEW-1',
        response,
        requiresDocumentation: true
      }
    })

    expect(statusCode).toBe(200)

    const licence = await findMarineLicence(marineLicenceId)

    expect(licence.marinePlanPolicyResponses).toEqual({
      'EXISTING-1': { response, requiresDocumentation: false },
      'EXISTING-2': { response: '', requiresDocumentation: false },
      'NEW-1': { response, requiresDocumentation: true }
    })
    expect(licence.marinePlanPolicyResponseCount).toBe(2)
  })

  test.each([`$${response}`, `$$${response}`])(
    'stores a response starting with $ verbatim: %s',
    async (dollarResponse) => {
      const marineLicenceId = new ObjectId()
      await insertMarineLicence({ _id: marineLicenceId, contactId })

      const { statusCode } = await makePatchRequest({
        server: getServer(),
        url: '/marine-licence/marine-plan-policy-response',
        contactId,
        payload: {
          id: marineLicenceId.toString(),
          policyCode: 'NEW-1',
          response: dollarResponse
        }
      })

      expect(statusCode).toBe(200)

      const licence = await findMarineLicence(marineLicenceId)

      expect(licence.marinePlanPolicyResponses['NEW-1']).toEqual({
        response: dollarResponse,
        requiresDocumentation: false
      })
    }
  )

  test('unticking a policy removes only its link from a document shared with another policy', async () => {
    const marineLicenceId = new ObjectId()
    const document = {
      ...mockLinkedMarinePlanPolicyDocument,
      policyLinks: [
        { policyCode: 'E-AGG-3', location: 'Section 4.2' },
        { policyCode: 'E-MPA-1', location: 'Section 5.1' }
      ]
    }
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyResponses: {
        'E-AGG-3': { response, requiresDocumentation: true },
        'E-MPA-1': { response, requiresDocumentation: true }
      },
      marinePlanPolicyDocuments: [document]
    })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-response',
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        policyCode: 'E-AGG-3',
        response,
        requiresDocumentation: false
      }
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await findMarineLicence(marineLicenceId)
    expect(updated.marinePlanPolicyDocuments).toHaveLength(1)
    expect(updated.marinePlanPolicyDocuments[0].documentId).toBe(
      document.documentId
    )
    expect(updated.marinePlanPolicyDocuments[0].policyLinks).toEqual([
      { policyCode: 'E-MPA-1', location: 'Section 5.1' }
    ])
    expect(updated.marinePlanPolicyResponses['E-AGG-3']).toEqual({
      response,
      requiresDocumentation: false
    })
  })

  test('unticking a policy that orphans a document without confirmation writes nothing', async () => {
    const marineLicenceId = new ObjectId()
    const document = mockLinkedMarinePlanPolicyDocument
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyResponses: {
        'E-MPA-1': { response, requiresDocumentation: false }
      },
      marinePlanPolicyDocuments: [document]
    })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-response',
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        policyCode: 'E-AGG-3',
        response,
        requiresDocumentation: false
      }
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({
      confirmationRequired: true,
      orphanedDocuments: [
        {
          documentId: document.documentId,
          filename: document.uploadedFile.filename
        }
      ]
    })

    const updated = await findMarineLicence(marineLicenceId)
    expect(updated.marinePlanPolicyDocuments).toHaveLength(1)
    expect(updated.marinePlanPolicyDocuments[0].documentId).toBe(
      document.documentId
    )
    expect(updated.marinePlanPolicyResponses).toEqual({
      'E-MPA-1': { response, requiresDocumentation: false }
    })
    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })

  test('unticking a policy that orphans a document with confirmation deletes it and its S3 file', async () => {
    const marineLicenceId = new ObjectId()
    const document = mockLinkedMarinePlanPolicyDocument
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyDocuments: [document]
    })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-response',
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        policyCode: 'E-AGG-3',
        response,
        requiresDocumentation: false,
        confirmDocumentDeletion: true
      }
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await findMarineLicence(marineLicenceId)
    expect(updated.marinePlanPolicyDocuments).toEqual([])
    expect(updated.marinePlanPolicyResponses['E-AGG-3']).toEqual({
      response,
      requiresDocumentation: false
    })
    expect(blobService.deleteFiles).toHaveBeenCalledWith([
      {
        s3Bucket: document.s3Location.s3Bucket,
        s3Key: document.s3Location.s3Key
      }
    ])
  })

  test('saving a response with the checkbox still ticked leaves the linked document in place', async () => {
    const marineLicenceId = new ObjectId()
    const document = mockLinkedMarinePlanPolicyDocument
    await insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      marinePlanPolicyDocuments: [document]
    })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-response',
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        policyCode: 'E-AGG-3',
        response,
        requiresDocumentation: true
      }
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await findMarineLicence(marineLicenceId)
    expect(updated.marinePlanPolicyDocuments).toEqual([document])
    expect(updated.marinePlanPolicyResponses['E-AGG-3']).toEqual({
      response,
      requiresDocumentation: true
    })
    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })
})
