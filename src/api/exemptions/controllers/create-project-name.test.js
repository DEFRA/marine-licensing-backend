import { createProjectNameController } from './create-project-name'
import { ObjectId } from 'mongodb'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../common/constants/exemption.js'

describe('POST /exemptions/project-name', () => {
  const payloadValidator = createProjectNameController.options.validate.payload
  const auth = { credentials: { contactId: new ObjectId().toHexString() } }

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
      { db: mockMongo, payload: { projectName: 'Project' }, auth },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success'
      })
    )
  })

  it('should create exemption with correct status and type properties', async () => {
    const { mockMongo, mockHandler } = global
    const mockInsertOne = jest.fn().mockResolvedValue({
      insertedId: new ObjectId()
    })

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        insertOne: mockInsertOne
      }
    })

    await createProjectNameController.handler(
      { db: mockMongo, payload: { projectName: 'Test Project' }, auth },
      mockHandler
    )

    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'Test Project',
        status: EXEMPTION_STATUS.DRAFT,
        type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
        contactId: expect.any(String)
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
        { db: mockMongo, payload: { projectName: 'Project' }, auth },
        mockHandler
      )
    ).rejects.toThrow(`Error creating project name: ${mockError}`)
  })
})
