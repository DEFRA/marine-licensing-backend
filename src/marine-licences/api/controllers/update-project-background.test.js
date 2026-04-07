import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateProjectBackgroundController } from './update-project-background.js'
import Boom from '@hapi/boom'

describe('PATCH /marine-licence/project-background', () => {
  const payloadValidator =
    updateProjectBackgroundController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should fail if fields are missing', () => {
    const result = payloadValidator.validate({})
    expect(result.error.message).toContain('PROJECT_BACKGROUND_REQUIRED')
  })

  it('should fail if background is empty string', () => {
    const result = payloadValidator.validate({
      projectBackground: ''
    })
    expect(result.error.message).toContain('PROJECT_BACKGROUND_REQUIRED')
  })

  it('should fail if background is whitespace only', () => {
    const result = payloadValidator.validate({
      projectBackground: '   '
    })
    expect(result.error.message).toContain('PROJECT_BACKGROUND_REQUIRED')
  })

  it('should fail if background exceeds 1000 characters', () => {
    const result = payloadValidator.validate({
      projectBackground: 'x'.repeat(1001)
    })
    expect(result.error.message).toContain('PROJECT_BACKGROUND_MAX_LENGTH')
  })

  it('should update marine licence with project background', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectBackground: 'Some background information about the project',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await updateProjectBackgroundController.handler(
      {
        db: mockMongo,
        payload: mockPayload
      },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'success' })
    )

    expect(mockMongo.collection).toHaveBeenCalledWith('marine-licences')
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          projectBackground: mockPayload.projectBackground,
          ...mockAuditPayload
        }
      }
    )
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectBackground: 'Some background information about the project',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updateProjectBackgroundController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating project background: ${mockError}`)
  })

  it('should return a 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      projectBackground: 'Some background information about the project',
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })
    vi.spyOn(Boom, 'notFound')

    await expect(() =>
      updateProjectBackgroundController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow('Marine licence not found')
  })
})
