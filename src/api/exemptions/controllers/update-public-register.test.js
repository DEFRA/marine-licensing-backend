import { ObjectId } from 'mongodb'
import { updatePublicRegisterController } from './update-public-register.js'
import Boom from '@hapi/boom'

describe('PATCH /exemptions/public-register', () => {
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

  it('should fail if consent is present but not a correct value', () => {
    const result = payloadValidator.validate({
      consent: 'incorrect value'
    })

    expect(result.error.message).toContain('PUBLIC_REGISTER_CONSENT_REQUIRED')
  })

  it('should fail if consent is empty string', () => {
    const result = payloadValidator.validate({
      consent: ''
    })

    expect(result.error.message).toContain('PUBLIC_REGISTER_CONSENT_REQUIRED')
  })

  it('should update exemption with public register', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      consent: false,
      ...mockAuditPayload
    }

    const mockUpdateOne = jest.fn().mockResolvedValueOnce({})
    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
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
      expect.objectContaining({
        message: 'success'
      })
    )

    expect(mockMongo.collection).toHaveBeenCalledWith('exemptions')
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          publicRegister: {
            reason: mockPayload.reason,
            consent: mockPayload.consent
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
      consent: false,
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    expect(() =>
      updatePublicRegisterController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating public register: ${mockError}`)
  })

  it('should return a  404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      consent: false,
      ...mockAuditPayload
    }

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    jest.spyOn(Boom, 'notFound')

    expect(() =>
      updatePublicRegisterController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Exemption not found`)
  })
})
