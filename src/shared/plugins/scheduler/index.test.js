import { vi } from 'vitest'
import { schedule, shutdown } from 'node-cron'
import { schedulerPlugin } from './index.js'
import { SCHEDULER_SHUTDOWN_TIMEOUT_MS } from '../../common/constants/job-scheduler.js'
import { scheduledJobs } from './scheduled-jobs.js'
import { config } from '../../../config.js'

// Partial mock: config.js validates the default schedule through the real
// parse(), so replacing the whole module breaks config import before any test
// runs. Only the two functions this suite drives are stubbed.
vi.mock('node-cron', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    schedule: vi.fn(),
    shutdown: vi.fn()
  }
})

const schedulerConfig = (overrides = {}) => ({
  isEnabled: true,
  timezone: 'Europe/London',
  jobs: { heartbeat: { isEnabled: true, schedule: '5 0 * * *' } },
  ...overrides
})

const createServer = () => ({
  ext: vi.fn(),
  method: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  app: {},
  db: { collection: vi.fn() }
})

const runExt = async (server, event) => {
  const handler = server.ext.mock.calls.find(([name]) => name === event)[1]
  await handler()
}

describe('scheduler plugin', () => {
  let server
  let task

  beforeEach(() => {
    server = createServer()
    task = { on: vi.fn(), destroy: vi.fn().mockResolvedValue(undefined) }
    vi.mocked(schedule).mockReturnValue(task)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes every job body as a server method even when scheduling is disabled', async () => {
    vi.spyOn(config, 'get').mockReturnValue(
      schedulerConfig({ isEnabled: false })
    )

    await schedulerPlugin.plugin.register(server)

    for (const job of scheduledJobs) {
      expect(server.method).toHaveBeenCalledWith(
        job.methodName,
        expect.any(Function),
        {}
      )
    }
    expect(server.ext).not.toHaveBeenCalled()
  })

  it('runs the job body when its server method is invoked', async () => {
    vi.spyOn(config, 'get').mockReturnValue(schedulerConfig())
    const heartbeat = scheduledJobs.find((job) => job.name === 'heartbeat')
    vi.spyOn(heartbeat, 'run').mockResolvedValue({ summary: 'ok' })

    await schedulerPlugin.plugin.register(server)

    const [, method] = server.method.mock.calls.find(
      ([name]) => name === 'runSchedulerHeartbeat'
    )
    await expect(method()).resolves.toEqual({ summary: 'ok' })
    expect(heartbeat.run).toHaveBeenCalledWith(server)
  })

  it('schedules each enabled job as a distributed task on start', async () => {
    vi.spyOn(config, 'get').mockReturnValue(schedulerConfig())

    await schedulerPlugin.plugin.register(server)
    await runExt(server, 'onPostStart')

    expect(schedule).toHaveBeenCalledWith(
      '5 0 * * *',
      expect.any(Function),
      expect.objectContaining({
        name: 'heartbeat',
        timezone: 'Europe/London',
        distributed: true,
        noOverlap: true
      })
    )
  })

  it('runs the job body when the scheduled task fires', async () => {
    vi.spyOn(config, 'get').mockReturnValue(schedulerConfig())
    const heartbeat = scheduledJobs.find((job) => job.name === 'heartbeat')
    vi.spyOn(heartbeat, 'run').mockResolvedValue({ summary: 'ok' })

    await schedulerPlugin.plugin.register(server)
    await runExt(server, 'onPostStart')

    const [, taskFn] = vi.mocked(schedule).mock.calls[0]

    await expect(taskFn()).resolves.toEqual({ summary: 'ok' })
    expect(heartbeat.run).toHaveBeenCalledWith(server)
  })

  it('attaches outcome logging to every task it schedules', async () => {
    vi.spyOn(config, 'get').mockReturnValue(schedulerConfig())

    await schedulerPlugin.plugin.register(server)
    await runExt(server, 'onPostStart')

    expect(task.on.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining([
        'execution:started',
        'execution:finished',
        'execution:failed',
        'execution:skipped',
        'execution:missed',
        'execution:overlap'
      ])
    )
  })

  it('logs each job it scheduled, naming the cron expression it armed', async () => {
    vi.spyOn(config, 'get').mockReturnValue(schedulerConfig())

    await schedulerPlugin.plugin.register(server)
    await runExt(server, 'onPostStart')

    expect(server.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'scheduler:heartbeat',
          reason: 'Enabled by configuration'
        })
      }),
      'Scheduled job heartbeat scheduled: 5 0 * * * (Europe/London)'
    )
  })

  it('gives every task a coordinator so only one instance runs a fire', async () => {
    vi.spyOn(config, 'get').mockReturnValue(schedulerConfig())

    await schedulerPlugin.plugin.register(server)
    await runExt(server, 'onPostStart')

    const [, , options] = vi.mocked(schedule).mock.calls[0]
    expect(typeof options.runCoordinator.shouldRun).toBe('function')
  })

  it('does not schedule a job that is disabled in config', async () => {
    vi.spyOn(config, 'get').mockReturnValue(
      schedulerConfig({
        jobs: { heartbeat: { isEnabled: false, schedule: '5 0 * * *' } }
      })
    )

    await schedulerPlugin.plugin.register(server)
    await runExt(server, 'onPostStart')

    expect(schedule).not.toHaveBeenCalled()
    expect(server.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ action: 'scheduler:heartbeat' })
      }),
      'Scheduled job heartbeat not scheduled: disabled by configuration'
    )
  })

  it('waits for any in-flight run before letting the service stop', async () => {
    vi.spyOn(config, 'get').mockReturnValue(schedulerConfig())

    await schedulerPlugin.plugin.register(server)
    await runExt(server, 'onPostStart')
    await runExt(server, 'onPreStop')

    expect(shutdown).toHaveBeenCalledWith(SCHEDULER_SHUTDOWN_TIMEOUT_MS)
    expect(task.destroy).not.toHaveBeenCalled()
    expect(server.app.schedulerTasks).toEqual([])
  })
})
