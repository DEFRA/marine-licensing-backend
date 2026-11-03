import {
  addMarinePlanPolicyDocumentSchema,
  marinePlanPolicyDocumentTypeSchema
} from './marine-plan-policy.js'
import { MPP_DOCUMENT_TYPES } from '../constants/marine-plan-policy-document.js'
import { ObjectId } from 'mongodb'

const marineLicenceId = new ObjectId().toHexString()
const uuid = '123e4567-e89b-12d3-a456-426614174000'

const buildAddPayload = (overrides = {}) => ({
  id: marineLicenceId,
  uploadedFile: { filename: 'doc.pdf' },
  s3Location: { s3Bucket: 'b', s3Key: 'k', checksumSha256: 'c' },
  ...overrides
})

const buildTypePayload = (overrides = {}) => ({
  id: marineLicenceId,
  documentId: uuid,
  documentType: MPP_DOCUMENT_TYPES[0],
  ...overrides
})

describe('addMarinePlanPolicyDocumentSchema', () => {
  test('accepts a valid add document payload', () => {
    expect(
      addMarinePlanPolicyDocumentSchema.validate(buildAddPayload()).error
    ).toBeUndefined()
  })

  test('requires the marine licence id', () => {
    const { id, ...withoutId } = buildAddPayload()
    const result = addMarinePlanPolicyDocumentSchema.validate(withoutId)
    expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  test('requires uploadedFile', () => {
    const { uploadedFile, ...withoutFile } = buildAddPayload()
    const result = addMarinePlanPolicyDocumentSchema.validate(withoutFile)
    expect(result.error.message).toContain('UPLOADED_FILE_REQUIRED')
  })

  test('requires s3Location', () => {
    const { s3Location, ...withoutLocation } = buildAddPayload()
    const result = addMarinePlanPolicyDocumentSchema.validate(withoutLocation)
    expect(result.error.message).toContain('S3_LOCATION_REQUIRED')
  })
})

describe('marinePlanPolicyDocumentTypeSchema', () => {
  test('accepts a valid document type payload for a standard type', () => {
    expect(
      marinePlanPolicyDocumentTypeSchema.validate(buildTypePayload()).error
    ).toBeUndefined()
  })

  test('accepts valid document type', () => {
    expect(
      marinePlanPolicyDocumentTypeSchema.validate(
        buildTypePayload({ documentType: MPP_DOCUMENT_TYPES[0] })
      ).error
    ).toBeUndefined()
  })

  test('rejects an unknown document type', () => {
    const result = marinePlanPolicyDocumentTypeSchema.validate(
      buildTypePayload({ documentType: 'not-a-real-type' })
    )
    expect(result.error.message).toContain('DOCUMENT_TYPE_REQUIRED')
  })

  test('requires a document id', () => {
    const { documentId, ...withoutDocumentId } = buildTypePayload()
    const result =
      marinePlanPolicyDocumentTypeSchema.validate(withoutDocumentId)
    expect(result.error.message).toContain('DOCUMENT_ID_REQUIRED')
  })

  test('requires other text when the document type is other', () => {
    const result = marinePlanPolicyDocumentTypeSchema.validate(
      buildTypePayload({ documentType: 'other', documentTypeOther: undefined })
    )
    expect(result.error.message).toContain('DOCUMENT_TYPE_OTHER_REQUIRED')
  })

  test('accepts other text with text when the document type is other', () => {
    expect(
      marinePlanPolicyDocumentTypeSchema.validate(
        buildTypePayload({
          documentType: 'other',
          documentTypeOther: 'Some rationale'
        })
      ).error
    ).toBeUndefined()
  })

  test('forbids other text when the document type is not other', () => {
    const result = marinePlanPolicyDocumentTypeSchema.validate(
      buildTypePayload({
        documentType: MPP_DOCUMENT_TYPES[0],
        documentTypeOther: 'should not be allowed'
      })
    )
    expect(result.error).toBeDefined()
  })

  test('rejects an invalid id', () => {
    const result = marinePlanPolicyDocumentTypeSchema.validate(
      buildTypePayload({ documentId: 'not-a-uuid' })
    )
    expect(result.error.message).toContain('valid GUID')
  })
})
