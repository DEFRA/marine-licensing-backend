import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { addMarinePlanPolicyDocumentController } from './add-marine-plan-policy-document.js'
import { mockMarinePlanPolicyDocument } from '../../../../../tests/test.fixture.js'
import { validateMppDocumentUpload } from '../../helpers/validate-mpp-document-upload.js'

vi.mock('../../helpers/validate-mpp-document-upload.js', () => ({
  validateMppDocumentUpload: vi.fn()
}))

describe('POST /marine-licence/marine-plan-policy-document', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    uploadedFile: mockMarinePlanPolicyDocument.uploadedFile,
    s3Location: mockMarinePlanPolicyDocument.s3Location,
    ...mockAuditPayload,
    ...overrides
  })

  const setupSuccessMocks = () => {
    const { mockMongo } = global
    const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
      updateOne: mockUpdateOne
    }))
    return mockUpdateOne
  }

  beforeEach(() => {
    validateMppDocumentUpload.mockResolvedValue(undefined)
  })

  describe('handler', () => {
    test('should validate the upload with the s3Location', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = buildPayload()
      setupSuccessMocks()

      await addMarinePlanPolicyDocumentController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )

      expect(validateMppDocumentUpload).toHaveBeenCalledWith(
        mockPayload.s3Location
      )
    })

    test('should propagate a Boom error from validation', async () => {
      const { mockMongo, mockHandler } = global
      setupSuccessMocks()

      const Boom = (await import('@hapi/boom')).default
      validateMppDocumentUpload.mockRejectedValue(
        Boom.forbidden('Invalid S3 bucket')
      )

      await expect(() =>
        addMarinePlanPolicyDocumentController.handler(
          { db: mockMongo, payload: buildPayload() },
          mockHandler
        )
      ).rejects.toThrow('Invalid S3 bucket')
    })
  })
})
