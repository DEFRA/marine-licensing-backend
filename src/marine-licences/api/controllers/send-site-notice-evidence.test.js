import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { sendSiteNoticeEvidenceController } from './send-site-notice-evidence.js'
import { APPLICATION_TASK_TYPE } from '../../constants/marine-licence.js'

describe('POST /marine-licence/send-site-notice-evidence', () => {
  const paramsValidator =
    sendSiteNoticeEvidenceController.options.validate.payload

  const mockMarineLicenceId = new ObjectId().toHexString()

  const buildRequest = (db) => ({
    db,
    payload: { id: mockMarineLicenceId }
  })

  it('should fail if fields are missing', () => {
    const result = paramsValidator.validate({})

    expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  it('should fail if fields are incorrect length', () => {
    const result = paramsValidator.validate({
      id: new ObjectId().toHexString().slice(0, 4)
    })

    expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  it('should fail if id has incorrect characters', () => {
    const invalidId = mockMarineLicenceId.replace('1', '+')
    const result = paramsValidator.validate({ id: invalidId })

    expect(result.error.message).toContain('MARINE_LICENCE_ID_INVALID')
  })

  it('should update the PUBLIC_SITE_NOTICE task with evidenceCompletedAt', async () => {
    const { mockMongo, mockHandler } = global

    const mockCollection = {
      updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    }

    vi.spyOn(mockMongo, 'collection').mockReturnValue(mockCollection)

    await sendSiteNoticeEvidenceController.handler(
      buildRequest(mockMongo),
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'success' })
    )

    expect(mockMongo.collection).toHaveBeenCalledWith('marine-licences')
    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      {
        _id: ObjectId.createFromHexString(mockMarineLicenceId),
        applicationTasks: {
          $elemMatch: {
            type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
            resolvedAt: null
          }
        }
      },
      {
        $set: {
          updatedAt: expect.any(Date),
          'applicationTasks.$.evidenceCompletedAt': expect.any(Date)
        }
      }
    )
  })

  it('should return a 404 if marine licence not found or no outstanding task', async () => {
    const { mockMongo, mockHandler } = global

    const mockCollection = {
      updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
    }

    vi.spyOn(mockMongo, 'collection').mockReturnValue(mockCollection)

    await expect(() =>
      sendSiteNoticeEvidenceController.handler(
        buildRequest(mockMongo),
        mockHandler
      )
    ).rejects.toThrow(
      'Marine licence not found or no outstanding PUBLIC_SITE_NOTICE task'
    )
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockError = 'Database failed'

    const mockCollection = {
      updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
    }

    vi.spyOn(mockMongo, 'collection').mockReturnValue(mockCollection)

    await expect(() =>
      sendSiteNoticeEvidenceController.handler(
        buildRequest(mockMongo),
        mockHandler
      )
    ).rejects.toThrow(`Error sending site notice evidence: ${mockError}`)
  })
})
