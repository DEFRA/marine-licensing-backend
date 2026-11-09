import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusCodes } from 'http-status-codes'

const cleanupTestData = vi.fn()

vi.mock('../cleanup-test-data.js', () => ({
  cleanupTestData: (...args) => cleanupTestData(...args)
}))

vi.mock('../../../common/helpers/logging/logger.js', () => ({
  structureErrorForECS: (error) => error
}))

const { cleanupTestDataController } = await import('./cleanup-test-data.js')

describe('cleanupTestDataController', () => {
  const h = {
    response: vi.fn().mockReturnValue({
      code: vi.fn().mockReturnValue('ok')
    })
  }

  beforeEach(() => {
    cleanupTestData.mockReset()
    h.response.mockClear()
  })

  it('returns cleanup results', async () => {
    const value = {
      environment: 'dev',
      contactId: null,
      deleted: { exemptions: 2 }
    }
    cleanupTestData.mockResolvedValue(value)

    const request = { db: {}, logger: { error: vi.fn() } }
    await cleanupTestDataController.handler(request, h)

    expect(cleanupTestData).toHaveBeenCalledWith(request.db)
    expect(h.response).toHaveBeenCalledWith({ message: 'success', value })
    expect(h.response().code).toHaveBeenCalledWith(StatusCodes.OK)
  })

  it('re-throws Boom errors', async () => {
    const boomError = Object.assign(new Error('missing'), {
      isBoom: true
    })
    cleanupTestData.mockRejectedValue(boomError)

    await expect(
      cleanupTestDataController.handler(
        { db: {}, logger: { error: vi.fn() } },
        h
      )
    ).rejects.toBe(boomError)
  })

  it('wraps unexpected errors', async () => {
    cleanupTestData.mockRejectedValue(new Error('mongo down'))

    await expect(
      cleanupTestDataController.handler(
        { db: {}, logger: { error: vi.fn() } },
        h
      )
    ).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 500 }
    })
  })
})
