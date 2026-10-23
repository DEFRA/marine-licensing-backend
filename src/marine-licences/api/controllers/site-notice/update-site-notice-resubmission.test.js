import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateSiteNoticeResubmissionController } from './update-site-notice-resubmission.js'

vi.mock('../../helpers/validateSiteNoticePhotoUpload.js')

describe('PATCH /marine-licence/update-site-notice-resubmission', () => {
  it('should throw a 500 when the database operation fails', async () => {
    const db = {
      collection: vi.fn().mockReturnValue({
        updateOne: vi.fn().mockRejectedValue(new Error('Database exploded'))
      })
    }
    const payload = {
      id: new ObjectId().toHexString(),
      taskId: new ObjectId().toHexString(),
      locationNumber: 1,
      updatedAt: new Date('2025-01-01T12:00:00Z'),
      updatedBy: 'user123',
      closeUpPhoto: { s3Location: { s3Key: 'key' } }
    }

    await expect(
      updateSiteNoticeResubmissionController.handler(
        { db, payload },
        global.mockHandler
      )
    ).rejects.toThrow(
      'Error updating site notice resubmission: Database exploded'
    )
  })
})
