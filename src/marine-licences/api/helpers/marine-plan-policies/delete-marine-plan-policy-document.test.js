import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { blobService } from '../../../../shared/services/data-service/blob-service.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { deleteMarinePlanPolicyDocument } from './delete-marine-plan-policy-document.js'

vi.mock('../../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

const s3Location = (s3Key) => ({
  s3Bucket: 'mmo-uploads',
  s3Key,
  checksumSha256: 'abc123'
})

const buildDocument = (documentId, s3Key) => ({
  documentId,
  uploadedFile: { filename: `${documentId}.pdf` },
  s3Location: s3Location(s3Key)
})

describe('deleteMarinePlanPolicyDocument', () => {
  const updatedAt = new Date('2025-01-01T12:00:00Z')
  const updatedBy = 'user123'
  const auditFields = { updatedAt, updatedBy }

  const collection = () => global.mockMongo.collection(collectionMarineLicences)

  const seed = async (marinePlanPolicyDocuments) => {
    const _id = new ObjectId()
    await collection().insertOne({ _id, marinePlanPolicyDocuments })
    return _id
  }

  test('removes only the given document and sets the audit fields', async () => {
    const toDelete = buildDocument('doc-1', 'key-1')
    const toKeep = buildDocument('doc-2', 'key-2')
    const _id = await seed([toDelete, toKeep])

    await deleteMarinePlanPolicyDocument({
      db: global.mockMongo,
      _id,
      document: toDelete,
      auditFields
    })

    const updated = await collection().findOne({ _id })
    expect(updated.marinePlanPolicyDocuments).toEqual([toKeep])
    expect(updated.updatedAt).toEqual(updatedAt)
    expect(updated.updatedBy).toBe(updatedBy)
  })

  test('removes the document without touching audit fields when none are given', async () => {
    const document = buildDocument('doc-1', 'key-1')
    const _id = await seed([document])

    await deleteMarinePlanPolicyDocument({
      db: global.mockMongo,
      _id,
      document
    })

    const updated = await collection().findOne({ _id })
    expect(updated.marinePlanPolicyDocuments).toEqual([])
    expect(updated).not.toHaveProperty('updatedAt')
    expect(updated).not.toHaveProperty('updatedBy')
  })

  test("deletes the document's S3 object", async () => {
    const document = buildDocument('doc-1', 'key-1')
    const _id = await seed([document])

    await deleteMarinePlanPolicyDocument({
      db: global.mockMongo,
      _id,
      document,
      auditFields
    })

    expect(blobService.deleteFiles).toHaveBeenCalledWith([
      { s3Bucket: 'mmo-uploads', s3Key: 'key-1' }
    ])
  })

  test('does not call S3 when the document has no s3Location', async () => {
    const document = { documentId: 'doc-1' }
    const _id = await seed([document])

    await deleteMarinePlanPolicyDocument({
      db: global.mockMongo,
      _id,
      document,
      auditFields
    })

    expect(blobService.deleteFiles).not.toHaveBeenCalled()
    const updated = await collection().findOne({ _id })
    expect(updated.marinePlanPolicyDocuments).toEqual([])
  })

  test('does not delete from S3 when the mongo update fails', async () => {
    const document = buildDocument('doc-1', 'key-1')
    const db = {
      collection: () => ({
        updateOne: vi.fn().mockRejectedValue(new Error('Database error'))
      })
    }

    await expect(
      deleteMarinePlanPolicyDocument({
        db,
        _id: new ObjectId(),
        document,
        auditFields
      })
    ).rejects.toThrow('Database error')

    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })
})
