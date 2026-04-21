import { vi } from 'vitest'
import { generateApplicationReference } from './reference-generator.js'
import Boom from '@hapi/boom'

/** `findOneAndUpdate` stores the next counter value; implementation returns `next - 1` as issued. */
function sequenceResult(nextPointer) {
  return { value: { currentSequence: nextPointer } }
}

describe('generateApplicationReference', () => {
  let mockDb
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

    mockDb = {
      collection: vi.fn().mockReturnValue({
        findOneAndUpdate: vi.fn(),
        findOne: vi.fn()
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
        mockDb
          .collection()
          .findOneAndUpdate.mockResolvedValue(sequenceResult(10002))

        const result = await generateApplicationReference(
          mockDb,
          applicationType
        )

        expect(result).toBe(`${expectedPrefix}/2025/10001`)
      }
    )

    it('should increment sequence number for subsequent calls', async () => {
      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValue(sequenceResult(10003))

      const result = await generateApplicationReference(mockDb, 'EXEMPTION')

      expect(result).toBe('EXE/2025/10002')
    })

    it('should format sequence number with leading zeros to 5 digits', async () => {
      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValue(sequenceResult(100000))

      const result = await generateApplicationReference(mockDb, 'EXEMPTION')

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

      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValue(sequenceResult(10002))

      const result = await generateApplicationReference(mockDb, 'EXEMPTION')

      expect(result).toBe('EXE/2026/10001')

      expect(mockDb.collection().findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'EXEMPTION_2026' },
        expect.arrayContaining([
          expect.objectContaining({
            $set: expect.objectContaining({
              year: { $ifNull: ['$year', 2026] },
              applicationType: { $ifNull: ['$applicationType', 'EXEMPTION'] }
            })
          })
        ]),
        expect.objectContaining({
          upsert: true,
          returnDocument: 'after'
        })
      )
    })
  })

  describe('Database Operations', () => {
    it('should upsert sequence document on first use', async () => {
      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValue(sequenceResult(10002))

      await generateApplicationReference(mockDb, 'EXEMPTION')

      expect(mockDb.collection).toHaveBeenCalledWith('reference-sequences')
      expect(mockDb.collection().findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'EXEMPTION_2025' },
        [
          {
            $set: {
              currentSequence: {
                $add: [{ $ifNull: ['$currentSequence', 10001] }, 1]
              },
              lastUpdated: mockDate,
              year: { $ifNull: ['$year', 2025] },
              applicationType: { $ifNull: ['$applicationType', 'EXEMPTION'] },
              key: { $ifNull: ['$key', 'EXEMPTION_2025'] },
              createdAt: { $ifNull: ['$createdAt', mockDate] }
            }
          }
        ],
        {
          upsert: true,
          returnDocument: 'after'
        }
      )
    })

    it('should use separate sequence keys per application type', async () => {
      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValue(sequenceResult(10002))

      await generateApplicationReference(mockDb, 'MARINE_LICENCE')

      expect(mockDb.collection().findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'MARINE_LICENCE_2025' },
        expect.any(Array),
        expect.any(Object)
      )
    })

    it('should pass session to findOneAndUpdate when provided', async () => {
      const session = { id: 'test-session' }
      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValue(sequenceResult(10002))

      await generateApplicationReference(mockDb, 'EXEMPTION', { session })

      expect(mockDb.collection().findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        expect.objectContaining({ session })
      )
    })
  })

  describe('Error Handling', () => {
    it('should throw error for unknown application type', async () => {
      const unknownType = 'UNKNOWN_TYPE'

      await expect(
        generateApplicationReference(mockDb, unknownType)
      ).rejects.toThrow(
        Boom.badImplementation(`Unknown application type: ${unknownType}`)
      )

      expect(mockDb.collection).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      const databaseError = new Error('Database connection failed')
      mockDb.collection().findOneAndUpdate.mockRejectedValue(databaseError)

      await expect(
        generateApplicationReference(mockDb, 'EXEMPTION')
      ).rejects.toThrow('Database connection failed')
    })

    it('should throw when update returns no document value', async () => {
      mockDb.collection().findOneAndUpdate.mockResolvedValue({ value: null })
      mockDb.collection().findOne.mockResolvedValue(null)

      await expect(
        generateApplicationReference(mockDb, 'EXEMPTION')
      ).rejects.toThrow(
        Boom.badImplementation('Reference sequence update returned no document')
      )
    })
  })

  describe('Application Type Support', () => {
    it('should default to EXEMPTION when no type specified', async () => {
      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValue(sequenceResult(10002))

      const result = await generateApplicationReference(mockDb)

      expect(result).toBe('EXE/2025/10001')
    })
  })

  describe('Edge Cases', () => {
    it('should handle year boundary correctly', async () => {
      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValueOnce(sequenceResult(15001))

      const result2025 = await generateApplicationReference(mockDb, 'EXEMPTION')
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

      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValueOnce(sequenceResult(10002))

      const result2026 = await generateApplicationReference(mockDb, 'EXEMPTION')
      expect(result2026).toBe('EXE/2026/10001')
    })

    it('should handle high sequence numbers correctly', async () => {
      mockDb
        .collection()
        .findOneAndUpdate.mockResolvedValue(sequenceResult(123457))

      const result = await generateApplicationReference(mockDb, 'EXEMPTION')

      expect(result).toBe('EXE/2025/123456')
    })
  })
})
