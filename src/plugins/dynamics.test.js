import { vi } from 'vitest'
import {
  startExemptionsQueuePolling,
  stopExemptionsQueuePolling,
  processExemptionsQueue
} from '../common/helpers/dynamics/index.js'

import { processExemptionsQueuePlugin } from './dynamics.js'
import { config } from '../config.js'

vi.mock('../common/helpers/dynamics/index.js')

describe('processExemptionsQueue Plugin', () => {
  const mockServer = {
    ext: vi.fn(),
    logger: { info: vi.fn() },
    app: {},
    method: vi.fn()
  }

  const mockedStartExemptionsQueuePolling = vi.mocked(
    startExemptionsQueuePolling
  )
  const mockedStopExemptionsQueuePolling = vi.mocked(stopExemptionsQueuePolling)

  beforeEach(() => {
    mockedStartExemptionsQueuePolling.mockClear()
    mockedStopExemptionsQueuePolling.mockClear()
  })

  it('should register hooks and log when enabled', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isDynamicsEnabled: true })

    await processExemptionsQueuePlugin.plugin.register(mockServer, {})

    expect(mockServer.ext).toHaveBeenCalledTimes(2)
    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'processExemptionsQueue plugin registered'
    )

    const calls = mockServer.ext.mock.calls

    const postStartHandler = calls.find(([event]) => event === 'onPostStart')[1]
    const preStopHandler = calls.find(([event]) => event === 'onPreStop')[1]

    postStartHandler()
    expect(startExemptionsQueuePolling).toHaveBeenCalledWith(
      mockServer,
      expect.any(Number)
    )

    preStopHandler()
    expect(stopExemptionsQueuePolling).toHaveBeenCalledWith(mockServer)
  })

  it('should not register hooks when disabled', async () => {
    await processExemptionsQueuePlugin.plugin.register(mockServer, {})
    expect(mockServer.ext).not.toHaveBeenCalled()
  })

  it('should work with defaults without config', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isDynamicsEnabled: true })

    await processExemptionsQueuePlugin.plugin.register(mockServer)

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'processExemptionsQueue plugin registered'
    )
  })

  it('should register the processExemptionsQueue server method', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isDynamicsEnabled: true })

    const mockServer = {
      ext: vi.fn(),
      logger: { info: vi.fn() },
      app: {},
      method: vi.fn()
    }

    await processExemptionsQueuePlugin.plugin.register(mockServer, {})

    expect(mockServer.method).toHaveBeenCalledWith(
      'processExemptionsQueue',
      expect.any(Function),
      {}
    )
  })

  it('should register the processExemptionsQueue server method with correct implementation', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isDynamicsEnabled: true })

    const mockServer = {
      ext: vi.fn(),
      logger: { info: vi.fn() },
      app: {},
      method: vi.fn()
    }

    vi.mocked(processExemptionsQueue).mockResolvedValue('processed')

    await processExemptionsQueuePlugin.plugin.register(mockServer, {})

    const registeredMethodCall = mockServer.method.mock.calls.find(
      ([name]) => name === 'processExemptionsQueue'
    )
    const registeredFunction = registeredMethodCall[1]

    const result = await registeredFunction()

    expect(processExemptionsQueue).toHaveBeenCalledWith(mockServer)
    expect(result).toBe('processed')
  })
})
