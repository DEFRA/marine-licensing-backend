import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updatePreferredDatesController } from './update-preferred-dates.js'

describe('PATCH /marine-licence/preferred-dates', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2026-05-21T12:00:00.000Z'),
    updatedBy: 'user123'
  }

  it('should update marine licence with preferred dates', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      start: { month: '05', year: '2026' },
      end: { month: '12', year: '2026' },
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return { updateOne: mockUpdateOne }
    })

    await updatePreferredDatesController.handler(
      { db: mockMongo, payload: mockPayload },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'success' })
    )
    expect(mockMongo.collection).toHaveBeenCalledWith('marine-licences')
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          preferredDates: {
            start: mockPayload.start,
            end: mockPayload.end
          },
          ...mockAuditPayload
        }
      }
    )
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      start: { month: '05', year: '2026' },
      end: { month: '12', year: '2026' },
      ...mockAuditPayload
    }

    const mockError = 'Database failed'
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updatePreferredDatesController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow(`Error updating preferred dates: ${mockError}`)
  })

  it('should return a 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      start: { month: '05', year: '2026' },
      end: { month: '12', year: '2026' },
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    await expect(() =>
      updatePreferredDatesController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow('Marine licence not found')
  })
})
