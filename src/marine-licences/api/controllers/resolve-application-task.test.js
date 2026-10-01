import { vi } from 'vitest'
import { resolveApplicationTaskController } from './resolve-application-task.js'

describe('resolveApplicationTaskController', () => {
  const id = '507f1f77bcf86cd799439011'
  const taskId = '507f1f77bcf86cd799439012'
  const paramsValidator =
    resolveApplicationTaskController.options.validate.params

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
      auth: {
        credentials: { contactId: 'bdd2cd26-15a6-4e0c-9f2e-9f06f8b7c2f1' }
      }
    }

    await expect(
      resolveApplicationTaskController.handler(request, global.mockHandler)
    ).rejects.toThrow('Error when attempting to resolve application task')
  })
})
