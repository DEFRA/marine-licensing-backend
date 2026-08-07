import { vi, describe, it, expect, beforeEach } from 'vitest'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import {
  collectS3Locations,
  filterUnreferencedS3Keys,
  deleteS3ObjectsBestEffort,
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

  it('collects drawings and the water framework directive document from a whole licence', () => {
    const marineLicence = {
      projectName: 'Test',
      siteDetails: [
        {
          constructionDrawings: [
            { s3Location: location('site-0-key-0') },
            { s3Location: location('site-0-key-1') }
          ]
        },
        { constructionDrawings: [{ s3Location: location('site-1-key-0') }] }
      ],
      waterFrameworkDirective: {
        nauticalMile: 'yes',
        s3Location: location('wfd-key')
      }
    }

    expect(collectS3Locations(marineLicence)).toEqual([
      { s3Bucket: bucket, s3Key: 'site-0-key-0' },
      { s3Bucket: bucket, s3Key: 'site-0-key-1' },
      { s3Bucket: bucket, s3Key: 'site-1-key-0' },
      { s3Bucket: bucket, s3Key: 'wfd-key' }
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

describe('filterUnreferencedS3Keys', () => {
  let db
  let toArray

  beforeEach(() => {
    toArray = vi.fn().mockResolvedValue([])
    db = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({ toArray })
      })
    }
  })

  it('returns all keys when no other licence references them', async () => {
    const candidates = [
      { s3Bucket: bucket, s3Key: 'key-1' },
      { s3Bucket: bucket, s3Key: 'key-2' }
    ]

    expect(await filterUnreferencedS3Keys(db, candidates)).toEqual(candidates)
  })

  it('retains a key still referenced by a copied licence', async () => {
    toArray.mockResolvedValue([
      {
        siteDetails: [
          { constructionDrawings: [{ s3Location: location('key-1') }] }
        ]
      }
    ])

    expect(
      await filterUnreferencedS3Keys(db, [{ s3Bucket: bucket, s3Key: 'key-1' }])
    ).toEqual([])

    expect(mockLogger.info).toHaveBeenCalledWith(
      { event: { action: 'delete', outcome: 'success' } },
      expect.stringContaining('key-1')
    )
  })

  it('deletes only the keys no longer referenced', async () => {
    toArray.mockResolvedValue([
      {
        siteDetails: [
          { constructionDrawings: [{ s3Location: location('shared') }] }
        ]
      }
    ])

    expect(
      await filterUnreferencedS3Keys(db, [
        { s3Bucket: bucket, s3Key: 'shared' },
        { s3Bucket: bucket, s3Key: 'unique' }
      ])
    ).toEqual([{ s3Bucket: bucket, s3Key: 'unique' }])
  })

  it('retains a key still referenced by another licence water framework directive document', async () => {
    toArray.mockResolvedValue([
      { waterFrameworkDirective: { s3Location: location('wfd-key') } }
    ])

    expect(
      await filterUnreferencedS3Keys(db, [
        { s3Bucket: bucket, s3Key: 'wfd-key' }
      ])
    ).toEqual([])
  })

  it('does not query mongo when there are no candidates', async () => {
    expect(await filterUnreferencedS3Keys(db, [])).toEqual([])
    expect(db.collection).not.toHaveBeenCalled()
  })
})

describe('deleteS3ObjectsBestEffort', () => {
  it('deletes the given locations', async () => {
    const s3Locations = [{ s3Bucket: bucket, s3Key: 'key-1' }]

    await deleteS3ObjectsBestEffort(s3Locations)

    expect(blobService.deleteFiles).toHaveBeenCalledWith(s3Locations)
  })

  it('does not call S3 for an empty list', async () => {
    await deleteS3ObjectsBestEffort([])

    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })

  it('logs and resolves when the S3 delete fails', async () => {
    blobService.deleteFiles.mockRejectedValue(new Error('S3 unavailable'))

    await expect(
      deleteS3ObjectsBestEffort([{ s3Bucket: bucket, s3Key: 'key-1' }])
    ).resolves.toBeUndefined()

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'S3 unavailable' })
      }),
      expect.stringContaining(`${bucket}/key-1`)
    )
  })
})

describe('deleteOrphanedS3Objects', () => {
  it('deletes only the unreferenced locations', async () => {
    const db = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              siteDetails: [
                { constructionDrawings: [{ s3Location: location('shared') }] }
              ]
            }
          ])
        })
      })
    }

    await deleteOrphanedS3Objects(db, [
      { s3Bucket: bucket, s3Key: 'shared' },
      { s3Bucket: bucket, s3Key: 'unique' }
    ])

    expect(blobService.deleteFiles).toHaveBeenCalledWith([
      { s3Bucket: bucket, s3Key: 'unique' }
    ])
  })

  it('does nothing when there are no locations', async () => {
    const db = { collection: vi.fn() }

    await deleteOrphanedS3Objects(db, [])

    expect(db.collection).not.toHaveBeenCalled()
    expect(blobService.deleteFiles).not.toHaveBeenCalled()
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
