import { jest } from '@jest/globals'
import { createServer } from '../server.js'

import {
  startExemptionsQueuePolling,
  stopExemptionsQueuePolling
} from '../common/helpers/dynamics.js'

import { processExemptionsQueuePlugin } from './dynamics.js'

jest.mock('../common/helpers/dynamics.js')

describe('processExemptionsQueue Plugin', () => {
  let server

  const mockedStartExemptionsQueuePolling = jest.mocked(
    startExemptionsQueuePolling
  )
  const mockedStopExemptionsQueuePolling = jest.mocked(
    stopExemptionsQueuePolling
  )

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

    server.logger.info = jest.fn()
    server.logger.error = jest.fn()
  })

  describe('Plugin Registration', () => {
    it('should register the plugin successfully', () => {
      expect(server.registrations['process-exemptions-queue']).toBeDefined()
    })

    it('should have correct plugin name', () => {
      const plugin = server.registrations['process-exemptions-queue']
      expect(plugin.name).toBe('process-exemptions-queue')
    })
  })
})

it('should not throw if register is called with undefined options', async () => {
  const mockServer = {
    ext: jest.fn(),
    logger: { info: jest.fn() }
  }
  await expect(
    processExemptionsQueuePlugin.plugin.register(mockServer, undefined)
  ).resolves.not.toThrow()

  expect(mockServer.logger.info).toHaveBeenCalledWith(
    'processExemptionsQueue plugin registered'
  )
})
