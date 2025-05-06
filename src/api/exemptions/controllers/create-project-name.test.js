import { createProjectNameController } from './create-project-name'

describe('POST /exemptions/project-name', () => {
  const payloadValidator = createProjectNameController.options.validate.payload

  it('should fail if fields are missing', () => {
    const result = payloadValidator.validate({})

    expect(result.error.message).toContain('PROJECT_NAME_REQUIRED')
  })

  it('should fail if name is empty string', () => {
    const result = payloadValidator.validate({
      projectName: ''
    })

    expect(result.error.message).toContain('PROJECT_NAME_REQUIRED')
  })

  it('should create a new exemption with project name', async () => {
    const { mockMongo, mockHandler } = global

    await createProjectNameController.handler(
      { db: mockMongo, payload: { projectName: 'Project' } },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success'
      })
    )
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global

    const mockError = 'Database failed'

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        insertOne: jest.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    expect(() =>
      createProjectNameController.handler(
        { db: mockMongo, payload: { projectName: 'Project' } },
        mockHandler
      )
    ).rejects.toThrow(`Error creating project name: ${mockError}`)
  })
})
