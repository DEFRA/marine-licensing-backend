import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { confirmSiteDetailsController } from './confirm-site-details.js'

describe('PATCH /marine-licence/confirm-site-details', () => {
  const payloadValidator = confirmSiteDetailsController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should fail if confirmed is missing', () => {
    const result = payloadValidator.validate({
      id: new ObjectId().toHexString()
    })
    expect(result.error).toBeDefined()
  })

  it('should fail if confirmed is not a boolean', () => {
    const result = payloadValidator.validate({
      id: new ObjectId().toHexString(),
      confirmed: 'yes'
    })
    expect(result.error).toBeDefined()
  })

  it('should update marine licence with siteDetailsConfirmed true', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      confirmed: true,
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await confirmSiteDetailsController.handler(
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
          siteDetailsConfirmed: true,
          ...mockAuditPayload
        }
      }
    )
  })

  it('should update marine licence with siteDetailsConfirmed false', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      confirmed: false,
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await confirmSiteDetailsController.handler(
      {
        db: mockMongo,
        payload: mockPayload
      },
      mockHandler
    )

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          siteDetailsConfirmed: false,
          ...mockAuditPayload
        }
      }
    )
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      confirmed: true,
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      confirmSiteDetailsController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error confirming site details: ${mockError}`)
  })

  it('should return a 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      confirmed: true,
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    await expect(() =>
      confirmSiteDetailsController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow('Marine licence not found')
  })
})
