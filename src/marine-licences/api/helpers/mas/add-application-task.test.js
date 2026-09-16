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

  let mockFindOneAndUpdate
  let db
  let logger

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mockFindOneAndUpdate = vi
      .fn()
      .mockResolvedValue({ _id: '507f1f77bcf86cd799439011' })
    db = {
      collection: vi
        .fn()
        .mockReturnValue({ findOneAndUpdate: mockFindOneAndUpdate })
    }
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  it('pushes a task with a null resolvedAt and writes no status', async () => {
    const result = await addApplicationTask(db, logger, {
      applicationReference,
      type,
      data,
      updatedBy: 'message-id'
    })

    const [filter, update] = mockFindOneAndUpdate.mock.calls[0]

    expect(filter).toEqual({
      applicationReference,
      applicationTasks: { $not: { $elemMatch: { type, resolvedAt: null } } }
    })
    expect(update.$push.applicationTasks).toEqual({
      taskId: expect.any(String),
      type,
      receivedAt: new Date(),
      resolvedAt: null,
      data
    })
    expect(update.$set).toEqual({
      updatedAt: new Date(),
      updatedBy: 'message-id'
    })
    expect(update.$set).not.toHaveProperty('status')
    expect(result.task.taskId).toEqual(expect.any(String))
  })

  it('does not add a duplicate when an unresolved task of the type already exists', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null)

    const result = await addApplicationTask(db, logger, {
      applicationReference,
      type,
      data,
      updatedBy: 'message-id'
    })

    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MAS_EVENT_ACTION.JOB_STALE
        })
      }),
      expect.stringContaining(applicationReference)
    )
  })

  it('rethrows so the queue retries when the update fails', async () => {
    const error = new Error('mongo is down')
    mockFindOneAndUpdate.mockRejectedValue(error)

    await expect(
      addApplicationTask(db, logger, {
        applicationReference,
        type,
        data,
        updatedBy: 'message-id'
      })
    ).rejects.toThrow('mongo is down')
    expect(logger.error).toHaveBeenCalled()
  })
})
