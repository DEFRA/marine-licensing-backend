import { vi } from 'vitest'
import { createMasPollerPlugin } from './poller.js'
import { config } from '../../../config.js'
import { runPollLoop } from '../../common/helpers/sqs/poll-loop.js'

vi.mock('../../common/helpers/sqs/poll-loop.js', () => ({
  runPollLoop: vi.fn()
}))

describe('createMasPollerPlugin', () => {
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

  it('should not start when the MAS feature is disabled', () => {
    vi.spyOn(config, 'get').mockReturnValueOnce({ isEnabled: false })
    const server = buildServer()

    createMasPollerPlugin({
      name: 'test-poller',
      receiveMessages: vi.fn(),
      processMessage: vi.fn()
    }).plugin.register(server)

    expect(server.ext).not.toHaveBeenCalled()
  })

  it('should start the poll loop onPostStart and stop it onPreStop', async () => {
    const server = buildServer()
    const receiveMessages = vi.fn()
    const processMessage = vi.fn()
    vi.mocked(runPollLoop).mockResolvedValue(undefined)

    const plugin = createMasPollerPlugin({
      name: 'test-poller',
      receiveMessages,
      processMessage
    })
    const hooks = registerAndGetHooks(server, plugin)

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
})
