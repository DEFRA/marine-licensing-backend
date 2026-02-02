import { vi } from 'vitest'
import { withdrawExemptionController } from './withdraw-exemption'

describe('POST /exemption/{id}/withdraw', () => {
  const paramsValidator = withdrawExemptionController.options.validate.params

  const mockId = '123456789123456789123456'

  it('should fail if fields are missing', () => {
    const result = paramsValidator.validate({})

    expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
  })

  it('should fail if fields are incorrect length', () => {
    const result = paramsValidator.validate({ id: '123' })

    expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
  })

  it('should fail if id has incorrect characters', () => {
    const result = paramsValidator.validate({ id: mockId.replace('1', '+') })

    expect(result.error.message).toContain('EXEMPTION_ID_INVALID')
  })

  it('should return not found error if exemption does not exist', async () => {
    const { mockMongo, mockHandler } = global

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValue({ matchedCount: 0 })
      }
    })

    await expect(() =>
      withdrawExemptionController.handler(
        { db: mockMongo, params: { id: mockId }, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow('Exemption not found during update')
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global

    const mockError = 'Database failed'

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      withdrawExemptionController.handler(
        { db: mockMongo, params: { id: mockId }, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow(
      `Error when attempting to withdraw exemption: ${mockError}`
    )
  })
})
