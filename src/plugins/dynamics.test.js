import { jest } from '@jest/globals'
import { createServer } from '../server.js'

import {
  startExemptionsQueuePolling,
  stopExemptionsQueuePolling,
  processExemptionsQueue
} from '../common/helpers/dynamics/index.js'

import { processExemptionsQueuePlugin } from './dynamics.js'
import { config } from '../config.js'

jest.mock('../common/helpers/dynamics/index.js')

describe('processExemptionsQueue Plugin', () => {
  let server

  const mockServer = {
    ext: jest.fn(),
    method: jest.fn(),
    logger: { info: jest.fn() },
    app: {}
  }

  const mockedStartExemptionsQueuePolling = jest.mocked(
    startExemptionsQueuePolling
  )
  const mockedStopExemptionsQueuePolling = jest.mocked(
    stopExemptionsQueuePolling
  )
  const mockedProcessExemptionsQueue = jest.mocked(processExemptionsQueue)

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    mockedStartExemptionsQueuePolling.mockClear()
    mockedStopExemptionsQueuePolling.mockClear()
    mockedProcessExemptionsQueue.mockClear()

    server.logger.info = jest.fn()
    server.logger.error = jest.fn()
  })

  it('should register hooks and log when enabled', async () => {
    jest.spyOn(config, 'get').mockReturnValueOnce({ isEnabled: true })

    await processExemptionsQueuePlugin.plugin.register(mockServer, {})

    expect(mockServer.ext).toHaveBeenCalledTimes(2)
    expect(mockServer.method).toHaveBeenCalledTimes(1)
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

  it('should register the processExemptionsQueue server method', async () => {
    jest.spyOn(config, 'get').mockReturnValueOnce({ isEnabled: true })

    await processExemptionsQueuePlugin.plugin.register(mockServer, {})

    expect(mockServer.method).toHaveBeenCalledWith(
      'processExemptionsQueue',
      expect.any(Function),
      {
        cache: false,
        generateKey: expect.any(Function)
      }
    )

    const methodCall = mockServer.method.mock.calls.find(
      ([name]) => name === 'processExemptionsQueue'
    )
    const methodFunction = methodCall[1]

    await methodFunction()
    expect(processExemptionsQueue).toHaveBeenCalledWith(mockServer)
  })

  it('should not register hooks when disabled', async () => {
    await processExemptionsQueuePlugin.plugin.register(mockServer, {})
    expect(mockServer.ext).not.toHaveBeenCalled()
    expect(mockServer.method).not.toHaveBeenCalled()
  })

  it('should work with defaults without config', async () => {
    jest.spyOn(config, 'get').mockReturnValueOnce({ isEnabled: true })

    await processExemptionsQueuePlugin.plugin.register(mockServer)

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      'processExemptionsQueue plugin registered'
    )
  })
})
