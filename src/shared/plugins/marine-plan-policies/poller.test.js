import { vi } from 'vitest'
import { createMarinePlanPoliciesPollerPlugin } from './poller.js'
import { config } from '../../../config.js'

describe('createMarinePlanPoliciesPollerPlugin', () => {
  const buildServer = () => ({
    app: {},
    ext: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn() }
  })

  const registerAndGetHooks = (server, plugin) => {
    plugin.plugin.register(server)
    const findHook = (name) =>
      server.ext.mock.calls.find(([event]) => event === name)?.[1]
    return {
      onPostStart: findHook('onPostStart'),
      onPreStop: findHook('onPreStop')
    }
  }

  it('should not start when the policies feature is disabled', () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isEnabled: false })
    const server = buildServer()

    createMarinePlanPoliciesPollerPlugin({
      name: 'test-poller',
      receiveMessages: vi.fn(),
      processMessage: vi.fn()
    }).plugin.register(server)

    expect(server.ext).not.toHaveBeenCalled()
  })

  it('should process received messages until stopped', async () => {
    const server = buildServer()
    const message = { MessageId: '1' }
    const processMessage = vi.fn().mockResolvedValue(undefined)

    const hooks = {}
    const receiveMessages = vi
      .fn()
      .mockImplementationOnce(async () => [message])
      .mockImplementation(async () => {
        hooks.onPreStop()
        return []
      })

    const plugin = createMarinePlanPoliciesPollerPlugin({
      name: 'test-poller',
      receiveMessages,
      processMessage
    })
    Object.assign(hooks, registerAndGetHooks(server, plugin))

    hooks.onPostStart()
    await server.app['test-poller'].loopPromise

    expect(processMessage).toHaveBeenCalledWith(server, message)
    expect(server.app['test-poller'].running).toBe(false)
  })

  it('should log receive failures and keep polling after the backoff', async () => {
    vi.useFakeTimers()
    try {
      const server = buildServer()
      const processMessage = vi.fn()

      const hooks = {}
      const receiveMessages = vi
        .fn()
        .mockImplementationOnce(async () => {
          throw new Error('queue unavailable')
        })
        .mockImplementation(async () => {
          hooks.onPreStop()
          return []
        })

      const plugin = createMarinePlanPoliciesPollerPlugin({
        name: 'test-poller',
        receiveMessages,
        processMessage
      })
      Object.assign(hooks, registerAndGetHooks(server, plugin))

      hooks.onPostStart()
      await vi.advanceTimersByTimeAsync(5000)
      await server.app['test-poller'].loopPromise

      expect(server.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Object) }),
        'test-poller receive loop failed; retrying'
      )
      expect(receiveMessages).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('should process all messages in a batch even after stop is signalled', async () => {
    const server = buildServer()
    const processMessage = vi.fn()

    const hooks = {}
    const receiveMessages = vi
      .fn()
      .mockImplementationOnce(async () => {
        hooks.onPreStop()
        return [{ MessageId: '1' }, { MessageId: '2' }]
      })
      .mockImplementation(async () => [])

    const plugin = createMarinePlanPoliciesPollerPlugin({
      name: 'test-poller',
      receiveMessages,
      processMessage
    })
    Object.assign(hooks, registerAndGetHooks(server, plugin))

    hooks.onPostStart()
    await server.app['test-poller'].loopPromise

    expect(processMessage).toHaveBeenCalledTimes(2)
  })
})
