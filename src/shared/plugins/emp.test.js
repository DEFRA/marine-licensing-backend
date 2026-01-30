import { vi } from 'vitest'
import {
  startEmpQueuePolling,
  stopEmpQueuePolling,
  processEmpQueue
} from '../common/helpers/emp/index.js'

import { processEmpQueuePlugin } from './emp.js'
import { config } from '../../config.js'

vi.mock('../common/helpers/emp/index.js')

describe('processEmpQueue Plugin', () => {
  const mockServer = {
    ext: vi.fn(),
    logger: { info: vi.fn() },
    app: {},
    method: vi.fn()
  }

  const mockedStartEmpQueuePolling = vi.mocked(startEmpQueuePolling)
  const mockedStopEmpQueuePolling = vi.mocked(stopEmpQueuePolling)

  beforeEach(() => {
    mockedStartEmpQueuePolling.mockClear()
    mockedStopEmpQueuePolling.mockClear()
  })

  it('should register hooks and log when enabled', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isEmpEnabled: true })

    await processEmpQueuePlugin.plugin.register(mockServer, {})

    expect(mockServer.ext).toHaveBeenCalledTimes(2)
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'processEmpQueue plugin registered'
    )

    const calls = mockServer.ext.mock.calls

    const postStartHandler = calls.find(([event]) => event === 'onPostStart')[1]
    const preStopHandler = calls.find(([event]) => event === 'onPreStop')[1]

    postStartHandler()
    expect(startEmpQueuePolling).toHaveBeenCalledWith(
      mockServer,
      expect.any(Number)
    )

    preStopHandler()
    expect(stopEmpQueuePolling).toHaveBeenCalledWith(mockServer)
  })

  it('should not register hooks when disabled', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isEmpEnabled: false })
    await processEmpQueuePlugin.plugin.register(mockServer, {})
    expect(mockServer.ext).not.toHaveBeenCalled()
  })

  it('should work with defaults without config', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isEmpEnabled: true })

    await processEmpQueuePlugin.plugin.register(mockServer)

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'processEmpQueue plugin registered'
    )
  })

  it('should register the processEmpQueue server method', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isEmpEnabled: true })

    const mockServer = {
      ext: vi.fn(),
      logger: { info: vi.fn() },
      app: {},
      method: vi.fn()
    }

    await processEmpQueuePlugin.plugin.register(mockServer, {})

    expect(mockServer.method).toHaveBeenCalledWith(
      'processEmpQueue',
      expect.any(Function),
      {}
    )
  })

  it('should register the processEmpQueue server method with correct implementation', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isEmpEnabled: true })

    const mockServer = {
      ext: vi.fn(),
      logger: { info: vi.fn() },
      app: {},
      method: vi.fn()
    }

    vi.mocked(processEmpQueue).mockResolvedValue('processed')

    await processEmpQueuePlugin.plugin.register(mockServer, {})

    const registeredMethodCall = mockServer.method.mock.calls.find(
      ([name]) => name === 'processEmpQueue'
    )
    const registeredFunction = registeredMethodCall[1]

    const result = await registeredFunction()

    expect(processEmpQueue).toHaveBeenCalledWith(mockServer)
    expect(result).toBe('processed')
  })
})
