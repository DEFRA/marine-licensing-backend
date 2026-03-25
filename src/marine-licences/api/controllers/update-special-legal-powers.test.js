import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateSpecialLegalPowersController } from './update-special-legal-powers.js'
import Boom from '@hapi/boom'

describe('PATCH /marine-licence/special-legal-powers', () => {
  const payloadValidator =
    updateSpecialLegalPowersController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should fail if fields are missing', () => {
    const result = payloadValidator.validate({})
    expect(result.error.message).toContain(
      'SPECIAL_LEGAL_POWERS_AGREE_REQUIRED'
    )
  })

  it('should fail if agree is not a valid value', () => {
    const result = payloadValidator.validate({
      agree: 'maybe'
    })
    expect(result.error.message).toContain(
      'SPECIAL_LEGAL_POWERS_AGREE_REQUIRED'
    )
  })

  it('should fail if agree is empty string', () => {
    const result = payloadValidator.validate({
      agree: ''
    })
    expect(result.error.message).toContain(
      'SPECIAL_LEGAL_POWERS_AGREE_REQUIRED'
    )
  })

  it('should update marine licence with special legal powers', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      agree: 'yes',
      details: 'Organisation has special powers',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await updateSpecialLegalPowersController.handler(
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
          specialLegalPowers: {
            agree: mockPayload.agree,
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
      agree: 'yes',
      details: 'Organisation has special powers',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updateSpecialLegalPowersController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating special legal powers: ${mockError}`)
  })

  it('should return a 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      agree: 'yes',
      details: 'Organisation has special powers',
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })
    vi.spyOn(Boom, 'notFound')

    await expect(() =>
      updateSpecialLegalPowersController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow('Marine licence not found')
  })

  it('should fail if agree is yes but details are missing', () => {
    const result = payloadValidator.validate({
      agree: 'yes'
    })
    expect(result.error.message).toContain(
      'SPECIAL_LEGAL_POWERS_DETAILS_REQUIRED'
    )
  })
})
