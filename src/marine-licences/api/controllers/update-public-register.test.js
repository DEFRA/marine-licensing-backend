import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updatePublicRegisterController } from './update-public-register.js'

describe('PATCH /marine-licence/public-register', () => {
  const payloadValidator =
    updatePublicRegisterController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should fail if fields are missing', () => {
    const result = payloadValidator.validate({})
    expect(result.error.message).toContain('PUBLIC_REGISTER_CONSENT_REQUIRED')
  })

  it('should fail if consent is not a valid value', () => {
    const result = payloadValidator.validate({
      consent: 'maybe'
    })
    expect(result.error.message).toContain('PUBLIC_REGISTER_CONSENT_REQUIRED')
  })

  it('should fail if consent is empty string', () => {
    const result = payloadValidator.validate({
      consent: ''
    })
    expect(result.error.message).toContain('PUBLIC_REGISTER_CONSENT_REQUIRED')
  })

  it('should fail if consent is yes but details are missing', () => {
    const result = payloadValidator.validate({
      consent: 'yes'
    })
    expect(result.error.message).toContain('PUBLIC_REGISTER_DETAILS_REQUIRED')
  })

  it('should update marine licence with public register consent yes and details', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      consent: 'yes',
      details: 'Details about public register consent',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await updatePublicRegisterController.handler(
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
          publicRegister: {
            consent: mockPayload.consent,
            details: mockPayload.details
          },
          ...mockAuditPayload
        }
      }
    )
  })

  it('should update marine licence with public register consent no', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      consent: 'no',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await updatePublicRegisterController.handler(
      {
        db: mockMongo,
        payload: mockPayload
      },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'success' })
    )

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          publicRegister: {
            consent: 'no',
            details: undefined
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
      consent: 'yes',
      details: 'Details about public register consent',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updatePublicRegisterController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating public register: ${mockError}`)
  })
})
