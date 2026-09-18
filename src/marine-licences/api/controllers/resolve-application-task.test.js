import { vi } from 'vitest'
import { resolveApplicationTaskController } from './resolve-application-task.js'

describe('resolveApplicationTaskController', () => {
  const id = '507f1f77bcf86cd799439011'
  const taskId = '507f1f77bcf86cd799439012'
  const contactId = 'bdd2cd26-15a6-4e0c-9f2e-9f06f8b7c2f1'

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
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      auth: { credentials: { contactId } }
    }
    const response = { code: vi.fn().mockReturnThis() }
    h = { response: vi.fn().mockReturnValue(response) }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves only the named unresolved task and writes no status', async () => {
    await resolveApplicationTaskController.handler(request, h)

    const [filter, update] = mockFindOneAndUpdate.mock.calls[0]

    expect(filter.applicationTasks).toEqual({
      $elemMatch: { taskId, resolvedAt: null }
    })
    expect(update.$set['applicationTasks.$.resolvedAt']).toEqual(new Date())
    expect(update.$set.updatedBy).toBe(contactId)
    expect(update.$set).not.toHaveProperty('status')
    expect(h.response).toHaveBeenCalledWith({
      message: 'success',
      value: { taskId }
    })
  })

  it('wraps unexpected failures as an internal error', async () => {
    mockFindOneAndUpdate.mockRejectedValue(new Error('mongo is down'))

    await expect(
      resolveApplicationTaskController.handler(request, h)
    ).rejects.toThrow('Error when attempting to resolve application task')
  })

  // Behaviour belongs to authorize-ownership.test.js; the 403 integration test
  // proves this route is wired to the right collection.
  it('guards the route with a pre-handler', () => {
    expect(resolveApplicationTaskController.options.pre).toHaveLength(1)
  })
})
