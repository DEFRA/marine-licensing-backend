import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updatePublicConsultationController } from './update-public-consultation.js'

describe('PATCH /marine-licence/public-consultation', () => {
  const payloadValidator =
    updatePublicConsultationController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should fail if fields are missing', () => {
    const result = payloadValidator.validate({})
    expect(result.error.message).toContain('PUBLIC_CONSULTATION_REQUIRED')
  })

  it('should fail if consulted is not a valid value', () => {
    const result = payloadValidator.validate({ consulted: 'maybe' })
    expect(result.error.message).toContain('PUBLIC_CONSULTATION_REQUIRED')
  })

  it('should fail if consulted is empty string', () => {
    const result = payloadValidator.validate({ consulted: '' })
    expect(result.error.message).toContain('PUBLIC_CONSULTATION_REQUIRED')
  })

  it('should fail if consulted is yes but details are missing', () => {
    const result = payloadValidator.validate({ consulted: 'yes' })
    expect(result.error.message).toContain(
      'PUBLIC_CONSULTATION_DETAILS_REQUIRED'
    )
  })

  it('should fail if consulted is no but details are provided', () => {
    const result = payloadValidator.validate({
      consulted: 'no',
      details: 'Some details'
    })
    expect(result.error).toBeDefined()
  })

  it('should update marine licence with consulted no', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      consulted: 'no',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return { updateOne: mockUpdateOne }
    })

    await updatePublicConsultationController.handler(
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
          publicConsultation: {
            consulted: 'no',
            details: undefined
          },
          ...mockAuditPayload
        }
      }
    )
  })

  it('should update marine licence with consulted yes and details', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      consulted: 'yes',
      details: 'Details of the public consultation carried out',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return { updateOne: mockUpdateOne }
    })

    await updatePublicConsultationController.handler(
      { db: mockMongo, payload: mockPayload },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'success' })
    )
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          publicConsultation: {
            consulted: 'yes',
            details: mockPayload.details
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
      consulted: 'yes',
      details: 'Details of the public consultation carried out',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updatePublicConsultationController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow(`Error updating public consultation: ${mockError}`)
  })

  it('should return a 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      consulted: 'yes',
      details: 'Details of the public consultation carried out',
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    await expect(() =>
      updatePublicConsultationController.handler(
        { db: mockMongo, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow('Marine licence not found')
  })
})
