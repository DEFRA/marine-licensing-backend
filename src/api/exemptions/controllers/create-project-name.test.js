import { createProjectNameController } from './create-project-name'
import { ObjectId } from 'mongodb'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../common/constants/exemption.js'

describe('POST /exemptions/project-name', () => {
  const payloadValidator = createProjectNameController.options.validate.payload
  const auth = { credentials: { contactId: new ObjectId().toHexString() } }
  const mockAuditPayload = {
    createdAt: new Date('2025-01-01T12:00:00Z'),
    createdBy: 'user123',
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

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
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }

    await createProjectNameController.handler(
      { db: mockMongo, payload: mockPayload, auth },
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
    const mockPayload = {
      projectName: 'Test Project',
      ...mockAuditPayload
    }
    const mockInsertOne = jest.fn().mockResolvedValue({
      insertedId: new ObjectId()
    })

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        insertOne: mockInsertOne
      }
    })

    await createProjectNameController.handler(
      { db: mockMongo, payload: mockPayload, auth },
      mockHandler
    )

    expect(mockInsertOne).toHaveBeenCalledWith({
      projectName: 'Test Project',
      status: EXEMPTION_STATUS.DRAFT,
      type: EXEMPTION_TYPE.EXEMPT_ACTIVITY,
      contactId: expect.any(String),
      ...mockAuditPayload
    })
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        insertOne: jest.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    expect(() =>
      createProjectNameController.handler(
        { db: mockMongo, payload: mockPayload, auth },
        mockHandler
      )
    ).rejects.toThrow(`Error creating project name: ${mockError}`)
  })
})
