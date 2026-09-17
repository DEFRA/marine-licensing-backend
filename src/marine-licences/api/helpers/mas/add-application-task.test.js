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
    mockFindOneAndUpdate = vi.fn()
    // First call is the supersede attempt, second the push of a new task.
    mockFindOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(licence)
    db = {
      collection: vi
        .fn()
        .mockReturnValue({ findOneAndUpdate: mockFindOneAndUpdate })
    }
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pushes a task with a null resolvedAt and writes no status', async () => {
    const result = await add()

    const [filter, update] = mockFindOneAndUpdate.mock.calls[1]

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
    expect(result.superseded).toBe(false)
  })

  it('overwrites an unresolved task of the same type rather than discarding the decision', async () => {
    const supersededTask = {
      taskId: 'existing-task',
      type,
      receivedAt: new Date(),
      resolvedAt: null,
      data
    }
    mockFindOneAndUpdate.mockReset()
    mockFindOneAndUpdate.mockResolvedValue({
      ...licence,
      applicationTasks: [supersededTask]
    })

    const result = await add()

    const [filter, update] = mockFindOneAndUpdate.mock.calls[0]

    expect(filter).toEqual({
      applicationReference,
      applicationTasks: { $elemMatch: { type, resolvedAt: null } }
    })
    expect(update.$set).toEqual({
      'applicationTasks.$.data': data,
      'applicationTasks.$.receivedAt': new Date(),
      updatedAt: new Date(),
      updatedBy: 'message-id'
    })
    expect(update.$set).not.toHaveProperty('status')
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      marineLicence: { ...licence, applicationTasks: [supersededTask] },
      task: supersededTask,
      superseded: true
    })
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MAS_EVENT_ACTION.APPLICATION_TASK_SUPERSEDED
        })
      }),
      expect.stringContaining(applicationReference)
    )
  })

  it('returns null when no marine licence matches the reference', async () => {
    mockFindOneAndUpdate.mockReset()
    mockFindOneAndUpdate.mockResolvedValue(null)

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
    mockFindOneAndUpdate.mockReset()
    mockFindOneAndUpdate.mockRejectedValue(new Error('mongo is down'))

    await expect(add()).rejects.toThrow('mongo is down')
    expect(logger.error).toHaveBeenCalled()
  })
})
