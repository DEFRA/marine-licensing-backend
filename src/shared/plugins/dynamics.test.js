import { vi } from 'vitest'
import {
  startDynamicsQueuePolling,
  stopDynamicsQueuePolling,
  processDynamicsQueue
} from '../common/helpers/dynamics/index.js'

import { processDynamicsQueuePlugin } from './dynamics.js'
import { config } from '../../config.js'

vi.mock('../common/helpers/dynamics/index.js')

describe('processDynamicsQueue Plugin', () => {
  const mockServer = {
    ext: vi.fn(),
    logger: { info: vi.fn() },
    app: {},
    method: vi.fn()
  }

  const mockedStartExemptionsQueuePolling = vi.mocked(startDynamicsQueuePolling)
  const mockedStopExemptionsQueuePolling = vi.mocked(stopDynamicsQueuePolling)

  beforeEach(() => {
    mockedStartExemptionsQueuePolling.mockClear()
    mockedStopExemptionsQueuePolling.mockClear()
  })

  it('should register hooks and log when enabled', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isDynamicsEnabled: true })

    await processDynamicsQueuePlugin.plugin.register(mockServer, {})

    expect(mockServer.ext).toHaveBeenCalledTimes(2)
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'processDynamicsQueue plugin registered'
    )

    const calls = mockServer.ext.mock.calls

    const postStartHandler = calls.find(([event]) => event === 'onPostStart')[1]
    const preStopHandler = calls.find(([event]) => event === 'onPreStop')[1]

    postStartHandler()
    expect(startDynamicsQueuePolling).toHaveBeenCalledWith(
      mockServer,
      expect.any(Number)
    )

    preStopHandler()
    expect(stopDynamicsQueuePolling).toHaveBeenCalledWith(mockServer)
  })

  it('should not register hooks when disabled', async () => {
    await processDynamicsQueuePlugin.plugin.register(mockServer, {})
    expect(mockServer.ext).not.toHaveBeenCalled()
  })

  it('should work with defaults without config', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isDynamicsEnabled: true })

    await processDynamicsQueuePlugin.plugin.register(mockServer)

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'processDynamicsQueue plugin registered'
    )
  })

  it('should register the processDynamicsQueue server method', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isDynamicsEnabled: true })

    const mockServer = {
      ext: vi.fn(),
      logger: { info: vi.fn() },
      app: {},
      method: vi.fn()
    }

    await processDynamicsQueuePlugin.plugin.register(mockServer, {})

    expect(mockServer.method).toHaveBeenCalledWith(
      'processDynamicsQueue',
      expect.any(Function),
      {}
    )
  })

  it('should register the processDynamicsQueue server method with correct implementation', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isDynamicsEnabled: true })

    const mockServer = {
      ext: vi.fn(),
      logger: { info: vi.fn() },
      app: {},
      method: vi.fn()
    }

    vi.mocked(processDynamicsQueue).mockResolvedValue('processed')

    await processDynamicsQueuePlugin.plugin.register(mockServer, {})

    const registeredMethodCall = mockServer.method.mock.calls.find(
      ([name]) => name === 'processDynamicsQueue'
    )
    const registeredFunction = registeredMethodCall[1]

    const result = await registeredFunction()

    expect(processDynamicsQueue).toHaveBeenCalledWith(mockServer)
    expect(result).toBe('processed')
  })
})
