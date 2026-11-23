import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { confirmPublicRegisterController } from './confirm-public-register.js'

describe('PATCH /marine-licence/confirm-public-register', () => {
  const payloadValidator =
    confirmPublicRegisterController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const mockUpdateOne = (updateOne) =>
    vi.spyOn(global.mockMongo, 'collection').mockImplementation(function () {
      return { updateOne }
    })

  it('should fail if any other field is sent', () => {
    const result = payloadValidator.validate({
      id: new ObjectId().toHexString(),
      confirmed: false
    })
    expect(result.error).toBeDefined()
  })

  it('should set publicRegisterConfirmed to true', async () => {
    const { mockMongo, mockHandler } = global
    const id = new ObjectId().toHexString()
    const updateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    mockUpdateOne(updateOne)

    await confirmPublicRegisterController.handler(
      { db: mockMongo, payload: { id, ...mockAuditPayload } },
      mockHandler
    )

    expect(mockMongo.collection).toHaveBeenCalledWith('marine-licences')
    expect(updateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { publicRegisterConfirmed: true, ...mockAuditPayload } }
    )
    expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
    expect(mockHandler.code).toHaveBeenCalledWith(200)
  })

  it('should throw an internal error if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    mockUpdateOne(vi.fn().mockRejectedValueOnce(new Error('Database failed')))

    await expect(() =>
      confirmPublicRegisterController.handler(
        {
          db: mockMongo,
          payload: { id: new ObjectId().toHexString(), ...mockAuditPayload }
        },
        mockHandler
      )
    ).rejects.toThrow('Error confirming public register: Database failed')
  })

  it('should throw not found if the marine licence does not exist', async () => {
    const { mockMongo, mockHandler } = global
    mockUpdateOne(vi.fn().mockResolvedValueOnce({ matchedCount: 0 }))

    await expect(() =>
      confirmPublicRegisterController.handler(
        {
          db: mockMongo,
          payload: { id: new ObjectId().toHexString(), ...mockAuditPayload }
        },
        mockHandler
      )
    ).rejects.toThrow('Marine licence not found')
  })
})
