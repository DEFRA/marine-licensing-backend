import { vi } from 'vitest'
import { config } from '../../../config.js'
import { marineLicenceDynamicsWorkerPlugin } from './worker.js'
import { marineLicenceDynamicsDlqWorkerPlugin } from './dlq-worker.js'

describe.each([
  ['worker', marineLicenceDynamicsWorkerPlugin],
  ['DLQ worker', marineLicenceDynamicsDlqWorkerPlugin]
])('marine licence Dynamics %s plugin', (_, plugin) => {
  const buildServer = () => ({
    app: {},
    ext: vi.fn(),
    logger: { info: vi.fn() }
  })

  const withDynamicsEnabled = (isDynamicsEnabled) =>
    vi
      .spyOn(config, 'get')
      .mockImplementation((key) =>
        key === 'dynamics' ? { isDynamicsEnabled } : undefined
      )

  it('should start polling when Dynamics is enabled', () => {
    withDynamicsEnabled(true)
    const server = buildServer()

    plugin.plugin.register(server)

    expect(server.ext).toHaveBeenCalledWith('onPostStart', expect.any(Function))
  })

  it('should not start polling when Dynamics is disabled', () => {
    withDynamicsEnabled(false)
    const server = buildServer()

    plugin.plugin.register(server)

    expect(server.ext).not.toHaveBeenCalled()
  })
})
