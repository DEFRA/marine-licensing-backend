import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { createActivityDescriptionController } from './create-activity-description'

describe('PATCH /exemptions/activity-description', () => {
  const payloadValidator =
    createActivityDescriptionController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should fail if fields are missing', () => {
    const result = payloadValidator.validate({})
    expect(result.error.message).toContain('ACTIVITY_DESCRIPTION_REQUIRED')
  })

  it('should fail if activity description is empty string', () => {
    const result = payloadValidator.validate({
      activityDescription: ''
    })
    expect(result.error.message).toContain('ACTIVITY_DESCRIPTION_REQUIRED')
  })

  it('should fail if activity description exceeds max length', () => {
    const longDescription = 'a'.repeat(4001)
    const result = payloadValidator.validate({
      activityDescription: longDescription
    })
    expect(result.error.message).toContain('ACTIVITY_DESCRIPTION_MAX_LENGTH')
  })

  it('should create a new exemption with activity description', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      activityDescription: 'Test Activity',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: mockUpdateOne
      }
    })

    await createActivityDescriptionController.handler(
      {
        db: mockMongo,
        payload: mockPayload
      },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success'
    })

    expect(mockMongo.collection).toHaveBeenCalledWith('exemptions')
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          activityDescription: mockPayload.activityDescription,
          ...mockAuditPayload
        }
      }
    )
  })

  it('should return an error message if the exemption is not found', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      activityDescription: 'Test Activity',
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    try {
      await createActivityDescriptionController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    } catch (error) {
      expect(error.isBoom).toBeTruthy()
      expect(error.output.statusCode).toBe(404)
      expect(error.message).toContain('Exemption not found')
    }
  })

  it('should return an internal server error if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      activityDescription: 'Test Activity',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    try {
      await createActivityDescriptionController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    } catch (error) {
      expect(error.isBoom).toBeTruthy()
      expect(error.output.statusCode).toBe(500)
      expect(error.message).toContain(
        `Error creating activity description: ${mockError}`
      )
    }
  })
})
