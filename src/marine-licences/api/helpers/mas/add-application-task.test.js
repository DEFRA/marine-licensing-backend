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

  const add = () =>
    addApplicationTask(db, logger, {
      applicationReference,
      type,
      data,
      updatedBy: 'message-id'
    })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mockFindOneAndUpdate = vi.fn().mockResolvedValue(licence)
    mockFindOne = vi.fn()
    db = {
      collection: vi.fn().mockReturnValue({
        findOneAndUpdate: mockFindOneAndUpdate,
        findOne: mockFindOne
      })
    }
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pushes a task with a null resolvedAt and leaves the status alone', async () => {
    const result = await add()

    const [filter, update] = mockFindOneAndUpdate.mock.calls[0]

    expect(filter).toEqual({
      applicationReference,
      applicationTasks: { $not: { $elemMatch: { type } } }
    })
    expect(update).toEqual({
      $push: {
        applicationTasks: {
          taskId: expect.any(String),
          type,
          receivedAt: new Date(),
          resolvedAt: null,
          sourceMessageId: 'message-id',
          data
        }
      },
      $set: { updatedAt: new Date(), updatedBy: 'message-id' }
    })
    expect(result.task.taskId).toEqual(expect.any(String))
    expect(mockFindOne).not.toHaveBeenCalled()
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

  it('rethrows so the queue retries when the update fails', async () => {
    mockFindOneAndUpdate.mockRejectedValue(new Error('mongo is down'))

    await expect(add()).rejects.toThrow('mongo is down')
    expect(logger.error).toHaveBeenCalled()
  })
})
