import { vi } from 'vitest'
import { updateProjectNameHandler } from './update-project-name-handler.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'

describe('updateProjectNameHandler', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const setupMockUpdateOne = (matchedCount = 1) => {
    const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount })
    vi.spyOn(global.mockMongo, 'collection').mockImplementation(function () {
      return { updateOne: mockUpdateOne }
    })
    return mockUpdateOne
  }

  let mockUpdateOne
  const collectionName = 'test-collection'
  const entityType = 'Test Entity'
  const handler = updateProjectNameHandler({
    collectionName,
    entityType
  })

  beforeEach(() => (mockUpdateOne = setupMockUpdateOne()))

  it('should update record with project name', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectName: 'Updated Project',
      ...mockAuditPayload
    }

    await handler({ db: mockMongo, payload: mockPayload }, mockHandler)

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success'
    })

    expect(mockMongo.collection).toHaveBeenCalledWith(collectionName)
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

  it('should return response with 201 CREATED status code', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectName: 'Updated Project',
      ...mockAuditPayload
    }

    await handler({ db: mockMongo, payload: mockPayload }, mockHandler)

    expect(mockHandler.code).toHaveBeenCalledWith(201)
  })

  it('should throw 404 when document is not found', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectName: 'Updated Project',
      ...mockAuditPayload
    }

    setupMockUpdateOne(0)

    await expect(
      handler({ db: mockMongo, payload: mockPayload }, mockHandler)
    ).rejects.toThrow(`${entityType} not found`)

    expect(mockMongo.collection).toHaveBeenCalledWith(collectionName)
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectName: 'Updated Project',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(
      handler({ db: mockMongo, payload: mockPayload }, mockHandler)
    ).rejects.toThrow(
      `Error updating project name for ${entityType}: ${mockError}`
    )

    expect(mockMongo.collection).toHaveBeenCalled()
  })

  it('should re-throw Boom errors', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectName: 'Updated Project',
      ...mockAuditPayload
    }

    const boomError = Boom.badRequest('Custom error')

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(boomError)
      }
    })

    await expect(
      handler({ db: mockMongo, payload: mockPayload }, mockHandler)
    ).rejects.toThrow('Custom error')
  })
})
