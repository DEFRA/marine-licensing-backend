import { vi } from 'vitest'
import { updateProjectNameHandler } from './update-project-name-handler.js'
import { ObjectId } from 'mongodb'

describe('updateProjectNameHandler', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const collectionName = 'test-collection'
  const entityType = 'Test Entity'
  const handler = updateProjectNameHandler({
    collectionName,
    entityType
  })

  const mockedUpdateOne = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockedUpdateOne.mockResolvedValue({ matchedCount: 1 })
    vi.spyOn(global.mockMongo, 'collection').mockImplementation(function () {
      return { updateOne: mockedUpdateOne }
    })
  })

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
    expect(mockedUpdateOne).toHaveBeenCalledWith(
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

  it('should throw 404 when document is not found', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectName: 'Updated Project',
      ...mockAuditPayload
    }

    mockedUpdateOne.mockResolvedValue({ matchedCount: 0 })

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
    mockedUpdateOne.mockRejectedValue(new Error(mockError))

    await expect(
      handler({ db: mockMongo, payload: mockPayload }, mockHandler)
    ).rejects.toThrow(
      `Error updating project name for ${entityType}: ${mockError}`
    )

    expect(mockMongo.collection).toHaveBeenCalled()
  })
})
