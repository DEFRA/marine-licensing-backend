import { vi } from 'vitest'
import { addApplicationTask } from './add-application-task.js'
import {
  APPLICATION_TASK_TYPE,
  MAS_EVENT_ACTION
} from '../../../constants/marine-licence.js'

describe('addApplicationTask', () => {
  const applicationReference = 'MMO-2027-00123'
  const type = APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION
  const data = { nationalSecurity: { withheldSome: true, comments: 'x' } }
  const licence = { _id: '507f1f77bcf86cd799439011' }

  let mockFindOneAndUpdate
  let mockFindOne
  let db
  let logger

  const add = (taskType = type) =>
    addApplicationTask(db, logger, {
      applicationReference,
      type: taskType,
      data,
      updatedBy: 'message-id'
    })

  beforeEach(() => {
    mockFindOneAndUpdate = vi.fn()
    mockFindOne = vi.fn()
    db = {
      collection: vi.fn().mockReturnValue({
        findOneAndUpdate: mockFindOneAndUpdate,
        findOne: mockFindOne
      })
    }
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  it('refuses a second task of the same type and leaves the stored one untouched', async () => {
    const existing = {
      taskId: 'existing-task',
      type,
      receivedAt: new Date(),
      resolvedAt: new Date(),
      sourceMessageId: 'an-earlier-message',
      data: { nationalSecurity: { withheldSome: false, comments: 'first' } }
    }
    mockFindOneAndUpdate.mockResolvedValue(null)
    mockFindOne.mockResolvedValue({ ...licence, applicationTasks: [existing] })

    const result = await add()

    expect(result).toBeNull()
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MAS_EVENT_ACTION.APPLICATION_TASK_DUPLICATE,
          outcome: 'failure'
        })
      }),
      expect.stringContaining(existing.taskId)
    )
  })

  it('treats a redelivery of the message that created the task as a no-op', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null)
    mockFindOne.mockResolvedValue({
      ...licence,
      applicationTasks: [
        {
          taskId: 'existing-task',
          type,
          resolvedAt: null,
          sourceMessageId: 'message-id',
          data
        }
      ]
    })

    const result = await add()

    expect(result).toBeNull()
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MAS_EVENT_ACTION.APPLICATION_TASK_REDELIVERED
        })
      }),
      expect.stringContaining(applicationReference)
    )
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('returns null when no marine licence matches the reference', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null)
    mockFindOne.mockResolvedValue(null)

    const result = await add()

    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MAS_EVENT_ACTION.LICENCE_NOT_FOUND,
          outcome: 'failure'
        })
      }),
      expect.stringContaining(applicationReference)
    )
  })

  describe('a repeatable task type', () => {
    const repeatable = APPLICATION_TASK_TYPE.RESUBMIT_SITE_NOTICE_EVIDENCE
    const resolvedRound = {
      taskId: 'first-round',
      type: repeatable,
      resolvedAt: new Date(),
      sourceMessageId: 'an-earlier-message'
    }

    it('names the outstanding task when refusing a second one', async () => {
      mockFindOneAndUpdate.mockResolvedValue(null)
      mockFindOne.mockResolvedValue({
        ...licence,
        applicationTasks: [
          resolvedRound,
          {
            taskId: 'second-round',
            type: repeatable,
            resolvedAt: null,
            sourceMessageId: 'another-message'
          }
        ]
      })

      expect(await add(repeatable)).toBeNull()
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            action: MAS_EVENT_ACTION.APPLICATION_TASK_DUPLICATE
          })
        }),
        expect.stringContaining('task second-round is still outstanding')
      )
    })

    it('throws so the queue retries when the blocking task was resolved after the push missed it', async () => {
      mockFindOneAndUpdate.mockResolvedValue(null)
      mockFindOne.mockResolvedValue({
        ...licence,
        applicationTasks: [resolvedRound]
      })

      await expect(add(repeatable)).rejects.toThrow('the queue will retry')
      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  it('rethrows so the queue retries when the update fails', async () => {
    mockFindOneAndUpdate.mockRejectedValue(new Error('mongo is down'))

    await expect(add()).rejects.toThrow('mongo is down')
    expect(logger.error).toHaveBeenCalled()
  })
})
