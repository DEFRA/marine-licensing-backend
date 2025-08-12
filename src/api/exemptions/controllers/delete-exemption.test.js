import Boom from '@hapi/boom'
import { deleteExemptionController } from './delete-exemption'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'

describe('DELETE /exemption', () => {
  const paramsValidator = deleteExemptionController.options.validate.params

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

  it('should delete exemption by id when status is DRAFT', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: jest.fn().mockResolvedValue({
          _id: mockId,
          status: EXEMPTION_STATUS.DRAFT
        }),
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
      }
    })

    await deleteExemptionController.handler(
      { db: mockMongo, params: { id: mockId } },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Exemption deleted successfully'
      })
    )
  })

  it('should return 400 if exemption status is not DRAFT', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: jest.fn().mockResolvedValue({
          _id: mockId,
          status: EXEMPTION_STATUS.SUBMITTED
        })
      }
    })

    await expect(
      deleteExemptionController.handler(
        { db: mockMongo, params: { id: mockId } },
        mockHandler
      )
    ).rejects.toThrow(
      Boom.badRequest(
        `Cannot delete exemption as exemption must be the status '${EXEMPTION_STATUS.DRAFT}'.`
      )
    )
  })

  it('should return 404 if ID does not exist', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: jest.fn().mockResolvedValue(null)
      }
    })

    await expect(
      deleteExemptionController.handler(
        { db: mockMongo, params: { id: mockId } },
        mockHandler
      )
    ).rejects.toThrow('Exemption not found')
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global

    const mockError = 'Database failed'

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: jest.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    expect(() =>
      deleteExemptionController.handler(
        { db: mockMongo, params: { id: mockId } },
        mockHandler
      )
    ).rejects.toThrow(`Error deleting exemption: ${mockError}`)
  })
})
