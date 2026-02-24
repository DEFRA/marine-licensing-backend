import { vi } from 'vitest'
import { deleteMarineLicenseController } from './delete-marine-license.js'
import { MARINE_LICENSE_STATUS } from '../../constants/marine-license.js'

describe('DELETE /marine-license', () => {
  const paramsValidator = deleteMarineLicenseController.options.validate.params

  const mockId = '123456789123456789123456'

  it('should fail if fields are missing', () => {
    const result = paramsValidator.validate({})

    expect(result.error.message).toContain('MARINE_LICENSE_ID_REQUIRED')
  })

  it('should fail if fields are incorrect length', () => {
    const result = paramsValidator.validate({ id: '123' })

    expect(result.error.message).toContain('MARINE_LICENSE_ID_REQUIRED')
  })

  it('should fail if id has incorrect characters', () => {
    const result = paramsValidator.validate({ id: mockId.replace('1', '+') })

    expect(result.error.message).toContain('MARINE_LICENSE_ID_INVALID')
  })

  it('should delete marine license by id when status is DRAFT', async () => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue({
          _id: mockId,
          status: MARINE_LICENSE_STATUS.DRAFT
        }),
        deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 })
      }
    })

    await deleteMarineLicenseController.handler(
      { db: mockMongo, params: { id: mockId } },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Marine license deleted successfully'
      })
    )
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      deleteMarineLicenseController.handler(
        { db: mockMongo, params: { id: mockId } },
        mockHandler
      )
    ).rejects.toThrow(`Error deleting marine license: ${mockError}`)
  })
})
