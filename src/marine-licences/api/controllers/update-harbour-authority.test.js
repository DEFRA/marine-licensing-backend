import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateHarbourAuthorityController } from './update-harbour-authority.js'

describe('PATCH /marine-licence/harbour-authority', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  test('should update marine licence with harbour authority', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      harbourArea: 'yes',
      details: 'Harbour authority details',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await updateHarbourAuthorityController.handler(
      {
        db: mockMongo,
        payload: mockPayload
      },
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
          harbourAuthority: {
            harbourArea: 'yes',
            details: 'Harbour authority details'
          },
          ...mockAuditPayload
        }
      }
    )
  })

  test('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      harbourArea: 'yes',
      details: 'Harbour authority details',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updateHarbourAuthorityController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating harbour authority: ${mockError}`)
  })

  test('should return a 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      harbourArea: 'yes',
      details: 'Harbour authority details',
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    await expect(() =>
      updateHarbourAuthorityController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow('Marine licence not found')
  })
})
