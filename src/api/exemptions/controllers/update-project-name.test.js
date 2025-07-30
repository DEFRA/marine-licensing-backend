import { ObjectId } from 'mongodb'
import { updateProjectNameController } from './update-project-name.js'

describe('PATCH /exemptions/public-register', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

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
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectName: 'Test project',
      ...mockAuditPayload
    }

    const mockUpdateOne = jest.fn().mockResolvedValueOnce({})
    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: mockUpdateOne
      }
    })

    await updateProjectNameController.handler(
      {
        db: mockMongo,
        payload: mockPayload,
        auth: { credentials: { contactId: 'user123' } }
      },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success'
    })

    expect(mockMongo.collection).toHaveBeenCalledWith('exemptions')
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          projectName: mockPayload.projectName,
          updatedAt: mockPayload.updatedAt,
          updatedBy: mockPayload.updatedBy
        }
      }
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

  it('should return a  404 if id is not correct', async () => {
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
