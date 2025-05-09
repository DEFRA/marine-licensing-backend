import { ObjectId } from 'mongodb'
import { updateProjectNameController } from './update-project-name.js'

describe('PATCH /exemptions/public-register', () => {
  const payloadValidator = updateProjectNameController.options.validate.payload

  it('should fail if fields are missing', () => {
    const result = payloadValidator.validate({})

    expect(result.error.message).toContain('PROJECT_NAME_REQUIRED')
  })

  it('should fail if consent is empty string', () => {
    const result = payloadValidator.validate({
      projectName: ''
    })

    expect(result.error.message).toContain('PROJECT_NAME_REQUIRED')
  })

  it('should update exemption with project name', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockResolvedValueOnce({})
      }
    })

    await updateProjectNameController.handler(
      {
        db: mockMongo,
        payload: {
          id: new ObjectId().toHexString(),
          projectName: 'Test project'
        }
      },
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
        updateOne: jest.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    expect(() =>
      updateProjectNameController.handler(
        {
          db: mockMongo,
          payload: {
            id: new ObjectId().toHexString(),
            projectName: 'Test project'
          }
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating project name: ${mockError}`)
  })

  it('should return an 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    expect(() =>
      updateProjectNameController.handler(
        {
          db: mockMongo,
          payload: { id: new ObjectId().toHexString(), consent: false }
        },
        mockHandler
      )
    ).rejects.toThrow(`Exemption not found`)
  })
})
