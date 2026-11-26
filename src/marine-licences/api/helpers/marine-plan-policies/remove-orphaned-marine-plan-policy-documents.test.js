import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { blobService } from '../../../../shared/services/data-service/blob-service.js'
import {
  findMarineLicence,
  insertMarineLicence
} from '../../../../../tests/test-helpers.js'
import {
  mockLinkedMarinePlanPolicyDocument as orphan,
  mockMarinePlanPolicies
} from '../../../../../tests/test.fixture.js'
import { removeOrphanedMarinePlanPolicyDocuments } from './remove-orphaned-marine-plan-policy-documents.js'

vi.mock('../../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

const policyJobId = 'job-1'
const requeriedPolicies = mockMarinePlanPolicies.filter(
  ({ policyCode }) => policyCode !== 'E-AGG-3'
)
const document = (documentId, policyLinks) => ({
  ...orphan,
  documentId,
  s3Location: { ...orphan.s3Location, s3Key: documentId },
  policyLinks
})

describe('removeOrphanedMarinePlanPolicyDocuments', () => {
  const logger = { info: vi.fn(), error: vi.fn() }

  const insertLicence = async (overrides) => {
    const { _id } = await insertMarineLicence({
      marinePlanPolicyJobId: policyJobId,
      ...overrides
    })
    return _id
  }

  const run = (_id, overrides) =>
    removeOrphanedMarinePlanPolicyDocuments({
      db: global.mockMongo,
      _id,
      policyJobId,
      marinePlanPolicies: requeriedPolicies,
      logger,
      ...overrides
    })

  const expectDocuments = async (_id, expected) => {
    const { marinePlanPolicyDocuments } = await findMarineLicence(_id)
    expect(marinePlanPolicyDocuments).toEqual(expected)
  }

  test('removes stale links, deletes documents left with none', async () => {
    const currentLink = { policyCode: 'E-MPA-1', location: 'Section 1' }
    const shared = document('shared', [...orphan.policyLinks, currentLink])
    const upload = document('upload', [])
    const _id = await insertLicence({
      marinePlanPolicyDocuments: [shared, orphan, upload]
    })

    await run(_id)

    await expectDocuments(_id, [
      { ...shared, policyLinks: [currentLink] },
      upload
    ])
    const { s3Bucket, s3Key } = orphan.s3Location
    expect(blobService.deleteFiles).toHaveBeenCalledWith([{ s3Bucket, s3Key }])
  })

  test('changes nothing when every link is still current', async () => {
    const _id = await insertLicence()

    await run(_id, { marinePlanPolicies: mockMarinePlanPolicies })

    await expectDocuments(_id, [orphan])
    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })

  test('changes nothing when the sites have changed since the job', async () => {
    const _id = await insertLicence({ marinePlanPolicyJobId: 'a-newer-job' })

    await run(_id)

    await expectDocuments(_id, [orphan])
    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })

  test('keeps a document uploaded between the read and the write', async () => {
    const upload = document('upload', [])
    const _id = await insertLicence({
      marinePlanPolicyDocuments: [orphan, upload]
    })

    const db = {
      collection: (name) =>
        Object.assign(global.mockMongo.collection(name), {
          findOne: async () => ({ marinePlanPolicyDocuments: [orphan] })
        })
    }

    await run(_id, { db })

    await expectDocuments(_id, [orphan, upload])
    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })

  test('logs and does not throw when the database fails', async () => {
    const db = {
      collection: () => ({
        findOne: async () => {
          throw new Error('connection lost')
        }
      })
    }

    await expect(run(new ObjectId(), { db })).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'connection lost' })
      }),
      expect.any(String)
    )
  })
})
