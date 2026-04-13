import { vi } from 'vitest'
import {
  generateApplicationReference,
  REFERENCE_LOCK_RETRY_DEFAULTS,
  totalReferenceLockRetryWaitMs
} from './reference-generator.js'
import Boom from '@hapi/boom'

describe('generateApplicationReference', () => {
  let mockDb
  let mockLocker
  let mockLock
  let mockDate

  beforeEach(() => {
    vi.resetAllMocks()

    mockDate = new Date('2025-06-15T10:30:00Z')
    const OriginalDate = Date
    vi.spyOn(global, 'Date').mockImplementation(function (...args) {
      if (args.length === 0) {
        return mockDate
      }
      return new OriginalDate(...args)
    })
    Date.now = vi.fn(() => mockDate.getTime())

    mockLock = {
      free: vi.fn().mockResolvedValue()
    }

    mockLocker = {
      lock: vi.fn().mockResolvedValue(mockLock)
    }

    mockDb = {
      collection: vi.fn().mockReturnValue({
        findOneAndUpdate: vi.fn(),
        updateOne: vi.fn()
      })
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Happy Path - Reference Generation', () => {
    it.each([
      ['EXEMPTION', 'EXE'],
      ['MARINE_LICENCE', 'MLA']
    ])(
      'should generate reference in correct format PREFIX/YYYY/NNNNN for %s',
      async (applicationType, expectedPrefix) => {
        const mockSequenceDoc = { currentSequence: 10001 }
        mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
        mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

        const result = await generateApplicationReference(
          mockDb,
          mockLocker,
          applicationType
        )

        expect(result).toBe(`${expectedPrefix}/2025/10001`)
      }
    )

    it('should increment sequence number for subsequent calls', async () => {
      const mockSequenceDoc = { currentSequence: 10002 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      const result = await generateApplicationReference(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )

      expect(result).toBe('EXE/2025/10002')
    })

    it('should format sequence number with leading zeros to 5 digits', async () => {
      const mockSequenceDoc = { currentSequence: 99999 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      const result = await generateApplicationReference(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )

      expect(result).toBe('EXE/2025/99999')
    })

    it('should reset sequence to seed for new year', async () => {
      const mockNewYearDate = new Date('2026-01-01T10:30:00Z')
      const OriginalDate = Date
      vi.spyOn(global, 'Date').mockImplementation(function (...args) {
        if (args.length === 0) {
          return mockNewYearDate
        }
        return new OriginalDate(...args)
      })
      Date.now = vi.fn(() => mockNewYearDate.getTime())

      const mockSequenceDoc = { currentSequence: 10001 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      const result = await generateApplicationReference(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )

      expect(result).toBe('EXE/2026/10001')

      expect(mockDb.collection().findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'EXEMPTION_2026' },
        expect.objectContaining({
          $setOnInsert: expect.objectContaining({
            key: 'EXEMPTION_2026',
            currentSequence: 10001,
            year: 2026,
            applicationType: 'EXEMPTION'
          })
        }),
        expect.objectContaining({
          upsert: true,
          returnDocument: 'after'
        })
      )
    })
  })

  describe('Database Operations', () => {
    it('should create sequence document on first use', async () => {
      const mockSequenceDoc = {
        currentSequence: 10001,
        key: 'EXEMPTION_2025',
        year: 2025,
        applicationType: 'EXEMPTION'
      }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      await generateApplicationReference(mockDb, mockLocker, 'EXEMPTION')

      expect(mockDb.collection).toHaveBeenCalledWith('reference-sequences')
      expect(mockDb.collection().findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'EXEMPTION_2025' },
        {
          $setOnInsert: {
            key: 'EXEMPTION_2025',
            currentSequence: 10001,
            year: 2025,
            applicationType: 'EXEMPTION',
            createdAt: mockDate
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      )
    })

    it('should use separate sequence keys per application type', async () => {
      const mockSequenceDoc = { currentSequence: 10001 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      await generateApplicationReference(mockDb, mockLocker, 'MARINE_LICENCE')

      expect(mockDb.collection().findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'MARINE_LICENCE_2025' },
        expect.objectContaining({
          $setOnInsert: expect.objectContaining({
            key: 'MARINE_LICENCE_2025',
            applicationType: 'MARINE_LICENCE'
          })
        }),
        expect.any(Object)
      )
    })

    it('should increment sequence after use', async () => {
      const mockSequenceDoc = { currentSequence: 10001 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      await generateApplicationReference(mockDb, mockLocker, 'EXEMPTION')

      expect(mockDb.collection().updateOne).toHaveBeenCalledWith(
        { key: 'EXEMPTION_2025' },
        {
          $inc: { currentSequence: 1 },
          $set: { lastUpdated: mockDate }
        }
      )
    })
  })

  describe('Thread Safety - MongoDB Locks', () => {
    it('should acquire lock before generating reference', async () => {
      const mockSequenceDoc = { currentSequence: 10001 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      await generateApplicationReference(mockDb, mockLocker, 'EXEMPTION')

      expect(mockLocker.lock).toHaveBeenCalledWith(
        'reference-generation-EXEMPTION_2025'
      )
    })

    it('should release lock after successful generation', async () => {
      const mockSequenceDoc = { currentSequence: 10001 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      await generateApplicationReference(mockDb, mockLocker, 'EXEMPTION')

      expect(mockLock.free).toHaveBeenCalled()
    })

    it('should release lock even if database operation fails', async () => {
      mockDb
        .collection()
        .findOneAndUpdate.mockRejectedValue(new Error('Database error'))

      await expect(
        generateApplicationReference(mockDb, mockLocker, 'EXEMPTION')
      ).rejects.toThrow('Database error')

      expect(mockLock.free).toHaveBeenCalled()
    })

    it('should return 503 with Retry-After after exhausting lock retries', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const fastRetry = {
        maxAttempts: 5,
        initialBackoffMs: 10,
        maxBackoffMs: 40
      }
      try {
        mockLocker.lock.mockResolvedValue(null)

        const promise = expect(
          generateApplicationReference(
            mockDb,
            mockLocker,
            'EXEMPTION',
            fastRetry
          )
        ).rejects.toMatchObject({
          message: 'Unable to acquire lock for reference generation',
          output: {
            statusCode: 503,
            headers: { 'Retry-After': expect.any(Number) }
          }
        })

        await vi.advanceTimersByTimeAsync(
          totalReferenceLockRetryWaitMs(fastRetry) + 50
        )
        await promise

        expect(mockDb.collection().findOneAndUpdate).not.toHaveBeenCalled()
        expect(mockLocker.lock).toHaveBeenCalledTimes(fastRetry.maxAttempts)
      } finally {
        vi.useRealTimers()
      }
    })

    it('should succeed on the second lock attempt after one contention', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        const mockSequenceDoc = { currentSequence: 10001 }
        mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
        mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

        mockLocker.lock.mockResolvedValueOnce(null).mockResolvedValue(mockLock)

        const retryOpts = {
          maxAttempts: 8,
          initialBackoffMs: 10,
          maxBackoffMs: 10
        }
        const resultPromise = generateApplicationReference(
          mockDb,
          mockLocker,
          'EXEMPTION',
          retryOpts
        )
        await vi.advanceTimersByTimeAsync(retryOpts.initialBackoffMs + 5)
        const result = await resultPromise

        expect(result).toBe('EXE/2025/10001')
        expect(mockLocker.lock).toHaveBeenCalledTimes(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('should succeed after many null lock responses then an acquired lock', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        const mockSequenceDoc = { currentSequence: 10001 }
        mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
        mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

        const retryOpts = {
          maxAttempts: 12,
          initialBackoffMs: 5,
          maxBackoffMs: 5
        }
        let call = 0
        mockLocker.lock.mockImplementation(async () => {
          call++
          return call < 8 ? null : mockLock
        })

        const resultPromise = generateApplicationReference(
          mockDb,
          mockLocker,
          'EXEMPTION',
          retryOpts
        )
        await vi.advanceTimersByTimeAsync(
          totalReferenceLockRetryWaitMs(retryOpts) + 20
        )
        const result = await resultPromise

        expect(result).toBe('EXE/2025/10001')
        expect(mockLocker.lock).toHaveBeenCalledTimes(8)
      } finally {
        vi.useRealTimers()
      }
    })

    it('should use default retry budget within roughly 1-2s', () => {
      const totalMs = totalReferenceLockRetryWaitMs()
      expect(totalMs).toBeGreaterThan(900)
      expect(totalMs).toBeLessThanOrEqual(2100)
      expect(REFERENCE_LOCK_RETRY_DEFAULTS.maxAttempts).toBeGreaterThanOrEqual(
        8
      )
    })
  })

  describe('Error Handling', () => {
    it('should throw error for unknown application type', async () => {
      const unknownType = 'UNKNOWN_TYPE'

      await expect(
        generateApplicationReference(mockDb, mockLocker, unknownType)
      ).rejects.toThrow(
        Boom.badImplementation(`Unknown application type: ${unknownType}`)
      )

      expect(mockLocker.lock).not.toHaveBeenCalled()
      expect(mockDb.collection).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      const databaseError = new Error('Database connection failed')
      mockDb.collection().findOneAndUpdate.mockRejectedValue(databaseError)

      await expect(
        generateApplicationReference(mockDb, mockLocker, 'EXEMPTION')
      ).rejects.toThrow('Database connection failed')

      expect(mockLock.free).toHaveBeenCalled()
    })
  })

  describe('Application Type Support', () => {
    it('should default to EXEMPTION when no type specified', async () => {
      const mockSequenceDoc = { currentSequence: 10001 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      const result = await generateApplicationReference(mockDb, mockLocker)

      expect(result).toBe('EXE/2025/10001')
    })
  })

  describe('Edge Cases', () => {
    it('should handle year boundary correctly', async () => {
      const year2025Doc = { currentSequence: 15000 }
      mockDb.collection().findOneAndUpdate.mockResolvedValueOnce(year2025Doc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      const result2025 = await generateApplicationReference(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )
      expect(result2025).toBe('EXE/2025/15000')

      const mockNewYearDate = new Date('2026-01-01T10:30:00Z')
      const OriginalDate = Date
      vi.spyOn(global, 'Date').mockImplementation(function (...args) {
        if (args.length === 0) {
          return mockNewYearDate
        }
        return new OriginalDate(...args)
      })
      Date.now = vi.fn(() => mockNewYearDate.getTime())

      const year2026Doc = { currentSequence: 10001 }
      mockDb.collection().findOneAndUpdate.mockResolvedValueOnce(year2026Doc)

      const result2026 = await generateApplicationReference(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )
      expect(result2026).toBe('EXE/2026/10001')
    })

    it('should handle high sequence numbers correctly', async () => {
      const mockSequenceDoc = { currentSequence: 123456 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      const result = await generateApplicationReference(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )

      expect(result).toBe('EXE/2025/123456')
    })
  })
})
