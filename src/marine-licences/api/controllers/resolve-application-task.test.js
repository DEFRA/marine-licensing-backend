import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { resolveApplicationTaskController } from './resolve-application-task.js'
import { APPLICATION_TASK_TYPE } from '../../constants/marine-licence.js'
import { config } from '../../../config.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/index.js'
import {
  DYNAMICS_QUEUE_TYPES,
  DYNAMICS_REQUEST_ACTIONS
} from '../../../shared/common/constants/request-queue.js'

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'dynamics') return { isDynamicsEnabled: false }
      if (key === 'backendGatewayUrl') return 'http://localhost:3001'
      return undefined
    })
  }
}))
vi.mock('../../../shared/common/helpers/dynamics/index.js')

describe('resolveApplicationTaskController', () => {
  const id = '507f1f77bcf86cd799439011'
  const taskId = '507f1f77bcf86cd799439012'
  const applicationReference = 'MLA/2026/00001'
  const paramsValidator =
    resolveApplicationTaskController.options.validate.params

  const auth = {
    credentials: { contactId: 'bdd2cd26-15a6-4e0c-9f2e-9f06f8b7c2f1' }
  }

  const siteNoticeEvidence = [
    {
      locationName: 'North pier',
      dateDisplayed: { day: '18', month: '10', year: '2026' },
      closeUpPhoto: {
        uploadedFile: { filename: 'close-up.jpg' },
        s3Location: {
          s3Bucket: 'mmo-uploads',
          s3Key: 'site-notice/close-up',
          checksumSha256: 'abc'
        }
      },
      positionPhoto: {
        uploadedFile: { filename: 'position.jpg' },
        s3Location: {
          s3Bucket: 'mmo-uploads',
          s3Key: 'site-notice/position',
          checksumSha256: 'def'
        }
      }
    }
  ]

  const publicSiteNoticeLicence = {
    _id: ObjectId.createFromHexString(id),
    applicationReference,
    siteNoticeEvidence,
    applicationTasks: [
      {
        taskId,
        type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
        resolvedAt: null
      }
    ]
  }

  it('should fail if the task id is missing', () => {
    const result = paramsValidator.validate({ id })

    expect(result.error.message).toContain('APPLICATION_TASK_ID_REQUIRED')
  })

  it('should fail if the task id is the wrong length', () => {
    const result = paramsValidator.validate({ id, taskId: '123' })

    expect(result.error.message).toContain('APPLICATION_TASK_ID_REQUIRED')
  })

  it('should fail if the task id has incorrect characters', () => {
    const result = paramsValidator.validate({
      id,
      taskId: taskId.replace('5', '+')
    })

    expect(result.error.message).toContain('APPLICATION_TASK_ID_INVALID')
  })

  it('wraps unexpected failures as an internal error', async () => {
    const request = {
      params: { id, taskId },
      db: {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi
            .fn()
            .mockRejectedValue(new Error('mongo is down'))
        })
      },
      logger: { info: vi.fn() },
      auth
    }

    await expect(
      resolveApplicationTaskController.handler(request, global.mockHandler)
    ).rejects.toThrow(
      'Error when attempting to resolve application task: mongo is down'
    )
  })

  it('queues site notice evidence for Dynamics when resolving a PUBLIC_SITE_NOTICE task', async () => {
    const { mockHandler } = global
    config.get.mockImplementation((key) => {
      if (key === 'dynamics') return { isDynamicsEnabled: true }
      if (key === 'backendGatewayUrl') return 'http://localhost:3001'
      return undefined
    })

    const request = {
      params: { id, taskId },
      db: {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi.fn().mockResolvedValue(publicSiteNoticeLicence)
        })
      },
      logger: { info: vi.fn(), error: vi.fn() },
      auth
    }

    await resolveApplicationTaskController.handler(request, mockHandler)

    expect(addToDynamicsQueue).toHaveBeenCalledWith({
      request,
      applicationReference,
      action: DYNAMICS_REQUEST_ACTIONS.SEND_SITE_NOTICE_EVIDENCE,
      type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
      locationCount: 1,
      locations: [
        {
          locationNumber: 1,
          locationName: 'North pier',
          dateDisplayed: '18 October 2026',
          closeUpPhoto: {
            filename: 'close-up.jpg',
            downloadUrl: `http://localhost:3001/public/marine-licence/${id}/site-notice-evidence/1/close-up/download-url`
          },
          positionPhoto: {
            filename: 'position.jpg',
            downloadUrl: `http://localhost:3001/public/marine-licence/${id}/site-notice-evidence/1/position/download-url`
          }
        }
      ]
    })
    expect(mockHandler.code).toHaveBeenCalledWith(200)
  })

  it('does not queue Dynamics when resolving a non site-notice task', async () => {
    const { mockHandler } = global
    config.get.mockImplementation((key) => {
      if (key === 'dynamics') return { isDynamicsEnabled: true }
      if (key === 'backendGatewayUrl') return 'http://localhost:3001'
      return undefined
    })

    const request = {
      params: { id, taskId },
      db: {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi.fn().mockResolvedValue({
            ...publicSiteNoticeLicence,
            applicationTasks: [
              {
                taskId,
                type: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
                resolvedAt: null
              }
            ]
          })
        })
      },
      logger: { info: vi.fn() },
      auth
    }

    await resolveApplicationTaskController.handler(request, mockHandler)

    expect(addToDynamicsQueue).not.toHaveBeenCalled()
  })

  it('does not queue Dynamics when the integration is disabled', async () => {
    const { mockHandler } = global
    config.get.mockImplementation((key) => {
      if (key === 'dynamics') return { isDynamicsEnabled: false }
      if (key === 'backendGatewayUrl') return 'http://localhost:3001'
      return undefined
    })

    const request = {
      params: { id, taskId },
      db: {
        collection: vi.fn().mockReturnValue({
          findOneAndUpdate: vi.fn().mockResolvedValue(publicSiteNoticeLicence)
        })
      },
      logger: { info: vi.fn() },
      auth
    }

    await resolveApplicationTaskController.handler(request, mockHandler)

    expect(addToDynamicsQueue).not.toHaveBeenCalled()
  })

  it('still returns success when Dynamics enqueue fails', async () => {
    const { mockHandler, mockMongo } = global
    config.get.mockImplementation((key) => {
      if (key === 'dynamics') return { isDynamicsEnabled: true }
      if (key === 'backendGatewayUrl') return 'http://localhost:3001'
      return undefined
    })
    addToDynamicsQueue.mockRejectedValueOnce(new Error('SQS unavailable'))
    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 })
    const findOneAndUpdate = vi.fn().mockResolvedValue(publicSiteNoticeLicence)

    const request = {
      params: { id, taskId },
      db: {
        collection: vi.fn().mockImplementation((name) => {
          if (name === 'marine-licences') {
            return { findOneAndUpdate, updateOne }
          }
          return mockMongo.collection(name)
        })
      },
      logger: { info: vi.fn(), error: vi.fn() },
      auth
    }

    await resolveApplicationTaskController.handler(request, mockHandler)

    expect(request.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ reference: applicationReference })
      }),
      expect.stringContaining('marked failed')
    )
    expect(updateOne).toHaveBeenCalledWith(
      {
        applicationReference,
        [`dynamicsOutbound.${DYNAMICS_REQUEST_ACTIONS.SEND_SITE_NOTICE_EVIDENCE}`]:
          { $ne: 'sent' }
      },
      {
        $set: {
          [`dynamicsOutbound.${DYNAMICS_REQUEST_ACTIONS.SEND_SITE_NOTICE_EVIDENCE}`]:
            'failed'
        }
      }
    )
    expect(mockHandler.code).toHaveBeenCalledWith(200)
  })
})
