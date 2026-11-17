import {
  addMarinePlanPolicyDocumentSchema,
  marinePlanPolicyDocumentLinksSchema,
  marinePlanPolicyDocumentTypeSchema
} from './marine-plan-policy.js'
import { MPP_DOCUMENT_LOCATION_MAX_LENGTH } from '../constants/marine-plan-policy-document.js'
import {
  mockLinkedMarinePlanPolicyDocument,
  mockMarinePlanPolicyDocument
} from '../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'

const marineLicenceId = new ObjectId().toHexString()
const { documentId, documentType, policyLinks } =
  mockLinkedMarinePlanPolicyDocument
const [linkedPolicy] = policyLinks

const buildAddPayload = (overrides = {}) => ({
  id: marineLicenceId,
  ...mockMarinePlanPolicyDocument,
  ...overrides
})

const buildTypePayload = (overrides = {}) => ({
  id: marineLicenceId,
  documentId,
  documentType,
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

  test.each(['ignored text', ''])(
    'strips other text (%j) when the document type is not other',
    (documentTypeOther) => {
      const result = marinePlanPolicyDocumentTypeSchema.validate(
        buildTypePayload({
          documentType,
          documentTypeOther
        })
      )
      expect(result.error).toBeUndefined()
      expect(result.value).not.toHaveProperty('documentTypeOther')
    }
  )

  test('rejects an invalid id', () => {
    const result = marinePlanPolicyDocumentTypeSchema.validate(
      buildTypePayload({ documentId: 'not-a-uuid' })
    )
    expect(result.error.message).toBe('DOCUMENT_ID_INVALID')
  })
})

const buildLinksPayload = (overrides = {}) => ({
  id: marineLicenceId,
  documentId,
  policyLinks,
  ...overrides
})

describe('marinePlanPolicyDocumentLinksSchema', () => {
  test('accepts a valid links payload', () => {
    expect(
      marinePlanPolicyDocumentLinksSchema.validate(buildLinksPayload()).error
    ).toBeUndefined()
  })

  test('requires a document id', () => {
    const { documentId, ...withoutDocumentId } = buildLinksPayload()
    const result =
      marinePlanPolicyDocumentLinksSchema.validate(withoutDocumentId)
    expect(result.error.message).toContain('DOCUMENT_ID_REQUIRED')
  })

  test.each([undefined, []])(
    'requires at least one policy link (%j)',
    (policyLinks) => {
      const result = marinePlanPolicyDocumentLinksSchema.validate(
        buildLinksPayload({ policyLinks })
      )
      expect(result.error.message).toContain('POLICY_LINKS_REQUIRED')
    }
  )

  test('rejects the same policy linked twice', () => {
    const result = marinePlanPolicyDocumentLinksSchema.validate(
      buildLinksPayload({
        policyLinks: [linkedPolicy, { ...linkedPolicy, location: 'Page 7' }]
      })
    )
    expect(result.error.message).toContain('POLICY_LINKS_DUPLICATE')
  })

  test('requires a policy code on each link', () => {
    const result = marinePlanPolicyDocumentLinksSchema.validate(
      buildLinksPayload({
        policyLinks: [{ location: linkedPolicy.location }]
      })
    )
    expect(result.error.message).toContain('POLICY_CODE_REQUIRED')
  })

  test.each([undefined, '', '   '])(
    'requires a location on each link (%j)',
    (location) => {
      const result = marinePlanPolicyDocumentLinksSchema.validate(
        buildLinksPayload({
          policyLinks: [{ ...linkedPolicy, location }]
        })
      )
      expect(result.error.message).toContain('DOCUMENT_LOCATION_REQUIRED')
    }
  )

  test('rejects a location over the maximum length', () => {
    const result = marinePlanPolicyDocumentLinksSchema.validate(
      buildLinksPayload({
        policyLinks: [
          {
            ...linkedPolicy,
            location: 'x'.repeat(MPP_DOCUMENT_LOCATION_MAX_LENGTH + 1)
          }
        ]
      })
    )
    expect(result.error.message).toContain('DOCUMENT_LOCATION_MAX_LENGTH')
  })
})
