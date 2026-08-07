import { vi, describe, it, expect } from 'vitest'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import {
  collectS3Locations,
  deleteOrphanedS3Objects
} from './deleteS3Objects.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}))

vi.mock('../../../shared/common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue(mockLogger),
  structureErrorForECS: vi.fn((error) => ({
    error: { message: error.message }
  }))
}))

const bucket = 'mmo-uploads'
const location = (s3Key) => ({
  s3Bucket: bucket,
  s3Key,
  checksumSha256: 'abc123'
})

describe('collectS3Locations', () => {
  it('collects the location from a single construction drawing', () => {
    expect(
      collectS3Locations({
        filename: 'drawing-1.pdf',
        s3Location: location('key-1')
      })
    ).toEqual([{ s3Bucket: bucket, s3Key: 'key-1' }])
  })

  it('skips drawings without an s3Location, including empty placeholders', () => {
    expect(
      collectS3Locations([
        {},
        { filename: 'drawing-2.pdf' },
        { filename: 'drawing-3.pdf', s3Location: location('key-3') }
      ])
    ).toEqual([{ s3Bucket: bucket, s3Key: 'key-3' }])
  })

  it('collects every drawing from a site', () => {
    const site = {
      coordinatesType: 'manual',
      constructionDrawings: [
        { s3Location: location('key-0') },
        {},
        { s3Location: location('key-2') }
      ]
    }

    expect(collectS3Locations(site.constructionDrawings)).toEqual([
      { s3Bucket: bucket, s3Key: 'key-0' },
      { s3Bucket: bucket, s3Key: 'key-2' }
    ])
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an incomplete s3Location', { s3Location: { s3Bucket: bucket } }]
  ])('returns an empty list for %s', (_description, source) => {
    expect(collectS3Locations(source)).toEqual([])
  })
})

describe('deleteOrphanedS3Objects', () => {
  let db
  let toArray

  const setupDb = (referencingLicences = []) => {
    toArray = vi.fn().mockResolvedValue(referencingLicences)
    db = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({ toArray })
      })
    }
    return db
  }

  const licenceReferencing = (...s3Keys) => ({
    siteDetails: [
      {
        constructionDrawings: s3Keys.map((s3Key) => ({
          s3Location: location(s3Key)
        }))
      }
    ]
  })

  it('deletes every location when no licence still references them', async () => {
    const candidates = [
      { s3Bucket: bucket, s3Key: 'key-1' },
      { s3Bucket: bucket, s3Key: 'key-2' }
    ]

    await deleteOrphanedS3Objects(setupDb(), candidates)

    expect(blobService.deleteFiles).toHaveBeenCalledWith(candidates)
  })

  it('queries only construction drawings for surviving references', async () => {
    const db = setupDb()

    await deleteOrphanedS3Objects(db, [{ s3Bucket: bucket, s3Key: 'key-1' }])

    expect(db.collection().find).toHaveBeenCalledWith(
      {
        'siteDetails.constructionDrawings.s3Location.s3Key': { $in: ['key-1'] }
      },
      { projection: { 'siteDetails.constructionDrawings.s3Location': 1 } }
    )
  })

  it('retains a key still referenced by a copied licence', async () => {
    await deleteOrphanedS3Objects(setupDb([licenceReferencing('key-1')]), [
      { s3Bucket: bucket, s3Key: 'key-1' }
    ])

    expect(blobService.deleteFiles).not.toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        event: {
          action: 'delete',
          reason: 'retained - still referenced by another marine licence'
        }
      },
      expect.stringContaining('key-1')
    )
  })

  it('deletes only the keys no longer referenced', async () => {
    await deleteOrphanedS3Objects(setupDb([licenceReferencing('shared')]), [
      { s3Bucket: bucket, s3Key: 'shared' },
      { s3Bucket: bucket, s3Key: 'unique' }
    ])

    expect(blobService.deleteFiles).toHaveBeenCalledWith([
      { s3Bucket: bucket, s3Key: 'unique' }
    ])
  })

  it('does nothing when there are no locations', async () => {
    const db = setupDb()

    await deleteOrphanedS3Objects(db, [])

    expect(db.collection).not.toHaveBeenCalled()
    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })

  it('logs and resolves when the S3 delete fails', async () => {
    blobService.deleteFiles.mockRejectedValueOnce(new Error('S3 unavailable'))

    await expect(
      deleteOrphanedS3Objects(setupDb(), [{ s3Bucket: bucket, s3Key: 'key-1' }])
    ).resolves.toBeUndefined()

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'S3 unavailable' })
      }),
      expect.stringContaining(`${bucket}/key-1`)
    )
  })

  it('logs and resolves when the reference lookup fails', async () => {
    const db = {
      collection: vi.fn().mockImplementation(() => {
        throw new Error('Mongo unavailable')
      })
    }

    await expect(
      deleteOrphanedS3Objects(db, [{ s3Bucket: bucket, s3Key: 'key-1' }])
    ).resolves.toBeUndefined()

    expect(blobService.deleteFiles).not.toHaveBeenCalled()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Mongo unavailable' })
      }),
      expect.stringContaining('Failed to determine orphaned S3 objects')
    )
  })
})
