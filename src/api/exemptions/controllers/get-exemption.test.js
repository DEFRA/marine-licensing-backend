import { getExemptionController } from './get-exemption'
import Boom from '@hapi/boom'

describe('GET /exemption', () => {
  const paramsValidator = getExemptionController.options.validate.params

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

  it('should get exemption by id', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: jest.fn().mockResolvedValue({ _id: mockId })
      }
    })

    await getExemptionController.handler(
      { db: mockMongo, params: { id: mockId } },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success',
        value: {
          id: mockId,
          taskList: { projectName: false, publicRegister: false }
        }
      })
    )
  })

  it('should return 404 if ID does not exist', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: jest.fn().mockResolvedValue(null)
      }
    })

    const result = await getExemptionController.handler(
      { db: mockMongo, params: { id: mockId } },
      mockHandler
    )

    expect(result).toEqual(Boom.notFound('Exemption not found'))
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
      getExemptionController.handler(
        { db: mockMongo, params: { id: mockId } },
        mockHandler
      )
    ).rejects.toThrow(`Error retrieving exemption: ${mockError}`)
  })
})
