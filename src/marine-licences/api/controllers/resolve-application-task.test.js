import { vi } from 'vitest'
import { StatusCodes } from 'http-status-codes'
import { resolveApplicationTaskController } from './resolve-application-task.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

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

  it('guards the route with an ownership check against marine licences', async () => {
    const [{ method }] = resolveApplicationTaskController.options.pre
    const findOne = vi.fn().mockResolvedValue({ contactId })
    const h = { continue: Symbol('continue') }

    await method(
      {
        ...request,
        db: { collection: vi.fn().mockReturnValue({ findOne }) }
      },
      h
    )

    expect(findOne).toHaveBeenCalled()
  })

  it('rejects a task belonging to another applicant', async () => {
    const [{ method }] = resolveApplicationTaskController.options.pre
    const collection = vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ contactId: 'someone-else' })
    })

    await expect(
      method({ ...request, db: { collection } }, {})
    ).rejects.toThrow('Not authorised to request this resource')

    expect(collection).toHaveBeenCalledWith(collectionMarineLicences)
  })
})
