import { vi } from 'vitest'
import { createSqsPollerPlugin } from './create-poller-plugin.js'
import { config } from '../../../../config.js'
import { runPollLoop } from './poll-loop.js'

vi.mock('./poll-loop.js', () => ({
  runPollLoop: vi.fn()
}))

describe('createSqsPollerPlugin', () => {
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

  it('should not start when the feature is disabled', () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isEnabled: false })
    const server = buildServer()

    createSqsPollerPlugin({
      name: 'test-poller',
      configKey: 'mas',
      receiveMessages: vi.fn(),
      processMessage: vi.fn()
    }).plugin.register(server)

    expect(config.get).toHaveBeenCalledWith('mas')
    expect(server.ext).not.toHaveBeenCalled()
  })

  it('should start the poll loop onPostStart and stop it onPreStop', async () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isEnabled: true })
    const server = buildServer()
    const receiveMessages = vi.fn()
    const processMessage = vi.fn()
    vi.mocked(runPollLoop).mockResolvedValue(undefined)

    const plugin = createSqsPollerPlugin({
      name: 'test-poller',
      configKey: 'marinePlanPolicies',
      receiveMessages,
      processMessage
    })
    const hooks = registerAndGetHooks(server, plugin)

    expect(config.get).toHaveBeenCalledWith('marinePlanPolicies')

    hooks.onPostStart()

    expect(server.app['test-poller'].running).toBe(true)
    expect(runPollLoop).toHaveBeenCalledWith(
      server,
      server.app['test-poller'],
      {
        receiveMessages,
        processMessage
      }
    )

    await hooks.onPreStop()

    expect(server.app['test-poller'].running).toBe(false)
  })

  it('should start when the isEnabled override returns true, without reading configKey', () => {
    const configGet = vi.spyOn(config, 'get')
    const server = buildServer()

    createSqsPollerPlugin({
      name: 'test-poller',
      isEnabled: () => true,
      receiveMessages: vi.fn(),
      processMessage: vi.fn()
    }).plugin.register(server)

    expect(configGet).not.toHaveBeenCalled()
    expect(server.ext).toHaveBeenCalledWith('onPostStart', expect.any(Function))
  })

  it('should not start when the isEnabled override returns false', () => {
    const server = buildServer()

    createSqsPollerPlugin({
      name: 'test-poller',
      isEnabled: () => false,
      receiveMessages: vi.fn(),
      processMessage: vi.fn()
    }).plugin.register(server)

    expect(server.ext).not.toHaveBeenCalled()
  })
})
