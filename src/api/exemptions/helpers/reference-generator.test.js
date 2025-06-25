import { generateApplicationReference } from './reference-generator.js'
import Boom from '@hapi/boom'

describe('generateApplicationReference', () => {
  let mockDb
  let mockLocker
  let mockLock
  let mockDate

  beforeEach(() => {
    jest.resetAllMocks()

    mockDate = new Date('2025-06-15T10:30:00Z')
    const OriginalDate = Date
    jest.spyOn(global, 'Date').mockImplementation((...args) => {
      if (args.length === 0) {
        return mockDate
      }
      return new OriginalDate(...args)
    })
    Date.now = jest.fn(() => mockDate.getTime())

    mockLock = {
      free: jest.fn().mockResolvedValue()
    }

    mockLocker = {
      lock: jest.fn().mockResolvedValue(mockLock)
    }

    mockDb = {
      collection: jest.fn().mockReturnValue({
        findOneAndUpdate: jest.fn(),
        updateOne: jest.fn()
      })
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Happy Path - Reference Generation', () => {
    it('should generate reference in correct format PREFIX/YYYY/NNNNN for exemption', async () => {
      const mockSequenceDoc = { currentSequence: 10001 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      const result = await generateApplicationReference(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )

      expect(result).toBe('EXE/2025/10001')
    })

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
      jest.spyOn(global, 'Date').mockImplementation((...args) => {
        if (args.length === 0) {
          return mockNewYearDate
        }
        return new OriginalDate(...args)
      })
      Date.now = jest.fn(() => mockNewYearDate.getTime())

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

    it('should throw error if unable to acquire lock', async () => {
      mockLocker.lock.mockResolvedValue(null)

      await expect(
        generateApplicationReference(mockDb, mockLocker, 'EXEMPTION')
      ).rejects.toThrow(
        Boom.internal('Unable to acquire lock for reference generation')
      )

      expect(mockDb.collection().findOneAndUpdate).not.toHaveBeenCalled()
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

    it('should handle explicit exemption type', async () => {
      const mockSequenceDoc = { currentSequence: 10001 }
      mockDb.collection().findOneAndUpdate.mockResolvedValue(mockSequenceDoc)
      mockDb.collection().updateOne.mockResolvedValue({ acknowledged: true })

      const result = await generateApplicationReference(
        mockDb,
        mockLocker,
        'EXEMPTION'
      )

      expect(result).toBe('EXE/2025/10001')
    })
  })

  describe('Edge Cases', () => {
    it('should handle year boundary correctly', async () => {
      const year2025Doc = { currentSequence: 15000 }
      const year2026Doc = { currentSequence: 10001 }

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
      jest.spyOn(global, 'Date').mockImplementation((...args) => {
        if (args.length === 0) {
          return mockNewYearDate
        }
        return new OriginalDate(...args)
      })
      Date.now = jest.fn(() => mockNewYearDate.getTime())

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
