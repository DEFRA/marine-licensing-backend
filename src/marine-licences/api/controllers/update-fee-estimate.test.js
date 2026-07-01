import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateFeeEstimateController } from './update-fee-estimate.js'

describe('PATCH /marine-licence/fee-estimate', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  test('should update marine licence with fee estimate', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      accept: 'yes',
      termsAndConditions: true,
      feeBand: '2A',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await updateFeeEstimateController.handler(
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
          feeEstimate: {
            accept: mockPayload.accept,
            termsAndConditions: mockPayload.termsAndConditions,
            feeBand: mockPayload.feeBand
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
      accept: 'yes',
      termsAndConditions: true,
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updateFeeEstimateController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating fee estimate: ${mockError}`)
  })

  test('should return a 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      accept: 'yes',
      termsAndConditions: true,
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    await expect(() =>
      updateFeeEstimateController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow('Marine licence not found')
  })
})
