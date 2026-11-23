import { vi } from 'vitest'
import joi from 'joi'
import { ObjectId } from 'mongodb'
import { updatePublicRegisterWithholdingController } from './update-public-register-withholding.js'

describe('updatePublicRegisterWithholdingController', () => {
  const schema = joi.object()
  const controller = updatePublicRegisterWithholdingController({
    schema,
    errorContext: 'public register test'
  })
  const id = new ObjectId().toHexString()
  const payload = {
    id,
    withholdConsent: 'yes',
    withholdReason: 'nationalSecurity',
    nationalSecurityApproval: 'yes',
    reason: 'Details',
    updatedAt: new Date(),
    updatedBy: 'user-id'
  }

  const mockUpdateOne = (updateOne) => {
    const { mockMongo } = global
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return { updateOne }
    })
  }

  it('should validate the payload with the given schema', () => {
    expect(controller.options.validate.payload).toBe(schema)
  })

  it('should store everything except the audit fields and id under publicRegister', async () => {
    const { mockMongo, mockHandler } = global
    const updateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    mockUpdateOne(updateOne)

    await controller.handler({ db: mockMongo, payload }, mockHandler)

    const { id: _id, updatedAt, updatedBy, ...publicRegister } = payload
    expect(updateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(id) },
      {
        $set: {
          publicRegister,
          publicRegisterConfirmed: false,
          updatedAt,
          updatedBy
        }
      }
    )
    expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
    expect(mockHandler.code).toHaveBeenCalledWith(200)
  })

  it('should return 404 if the marine licence is not found', async () => {
    const { mockMongo, mockHandler } = global
    mockUpdateOne(vi.fn().mockResolvedValueOnce({ matchedCount: 0 }))

    await expect(() =>
      controller.handler({ db: mockMongo, payload }, mockHandler)
    ).rejects.toMatchObject({
      message: 'Marine licence not found',
      output: { statusCode: 404 }
    })
  })

  it('should include the error context if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    mockUpdateOne(vi.fn().mockRejectedValueOnce(new Error('Database failed')))

    await expect(() =>
      controller.handler({ db: mockMongo, payload }, mockHandler)
    ).rejects.toThrow('Error updating public register test: Database failed')
  })
})
