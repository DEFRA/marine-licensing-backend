import { vi } from 'vitest'
import { StatusCodes } from 'http-status-codes'
import { resolveApplicationTaskController } from './resolve-application-task.js'

describe('resolveApplicationTaskController', () => {
  const id = '507f1f77bcf86cd799439011'
  const taskId = '507f1f77bcf86cd799439012'

  let mockFindOneAndUpdate
  let request
  let h

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    mockFindOneAndUpdate = vi.fn().mockResolvedValue({ _id: id })
    request = {
      params: { id, taskId },
      db: {
        collection: vi
          .fn()
          .mockReturnValue({ findOneAndUpdate: mockFindOneAndUpdate })
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }
    const response = { code: vi.fn().mockReturnThis() }
    h = { response: vi.fn().mockReturnValue(response) }
  })

  it('resolves only the named unresolved task and writes no status', async () => {
    await resolveApplicationTaskController.handler(request, h)

    const [filter, update] = mockFindOneAndUpdate.mock.calls[0]

    expect(filter.applicationTasks).toEqual({
      $elemMatch: { taskId, resolvedAt: null }
    })
    expect(update.$set['applicationTasks.$.resolvedAt']).toEqual(new Date())
    expect(update.$set).not.toHaveProperty('status')
    expect(h.response).toHaveBeenCalledWith({
      message: 'success',
      value: { taskId }
    })
  })

  it('succeeds idempotently when the task is already resolved', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null)

    await resolveApplicationTaskController.handler(request, h)

    expect(h.response).toHaveBeenCalledWith({
      message: 'success',
      value: { taskId }
    })
    expect(h.response().code).toHaveBeenCalledWith(StatusCodes.OK)
  })

  it('wraps unexpected failures as an internal error', async () => {
    mockFindOneAndUpdate.mockRejectedValue(new Error('mongo is down'))

    await expect(
      resolveApplicationTaskController.handler(request, h)
    ).rejects.toThrow('Error when attempting to resolve application task')
  })

  it('guards the route with the ownership pre-handler', () => {
    expect(resolveApplicationTaskController.options.pre).toHaveLength(1)
  })
})
