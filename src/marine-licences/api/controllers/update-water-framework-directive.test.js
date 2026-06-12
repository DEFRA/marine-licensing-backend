import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateWaterFrameworkDirectiveController } from './update-water-framework-directive.js'
import { validateWfdUpload } from '../helpers/validateWfdUpload.js'

vi.mock('../helpers/validateWfdUpload.js')

describe('PATCH /marine-licence/water-framework-directive', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      waterFrameworkDirective: { nauticalMile: 'yes' },
      ...mockAuditPayload
    }

    const mockError = 'Database failed'
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updateWaterFrameworkDirectiveController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow(`Error updating water framework directive: ${mockError}`)

    expect(validateWfdUpload).toHaveBeenCalledWith(
      mockPayload.waterFrameworkDirective
    )
  })
})
