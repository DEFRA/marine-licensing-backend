import { vi } from 'vitest'
import {
  attachScheduledJobLogging,
  logScheduledJobDisabled,
  logScheduledJobEnabled
} from './scheduled-job-logging.js'

const FIRE_DATE = new Date('2026-08-15T00:05:00.000Z')

const createLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
})

const createTask = () => {
  const handlers = {}
  return {
    on: vi.fn((event, handler) => {
      handlers[event] = handler
    }),
    emit: (event, context) => handlers[event](context)
  }
}

describe('attachScheduledJobLogging', () => {
  let logger
  let task

  beforeEach(() => {
    logger = createLogger()
    task = createTask()
    attachScheduledJobLogging(task, 'heartbeat', logger)
  })

  it('subscribes to the start event and to every outcome event', () => {
    expect(task.on.mock.calls.map(([event]) => event)).toEqual([
      'execution:started',
      'execution:finished',
      'execution:failed',
      'execution:skipped',
      'execution:missed',
      'execution:overlap'
    ])
  })

  it('logs a start line so a run that never completes is detectable', () => {
    task.emit('execution:started', { date: FIRE_DATE })

    expect(logger.info).toHaveBeenCalledWith(
      {
        event: {
          action: 'scheduler:heartbeat',
          outcome: 'unknown',
          reference: '2026-08-15T00:05:00.000Z'
        }
      },
      'Scheduled job heartbeat started'
    )
  })

  it('logs a success with the job summary in the message', () => {
    task.emit('execution:finished', {
      date: FIRE_DATE,
      execution: {
        result: { summary: '12 active exemptions' },
        startedAt: new Date('2026-08-15T00:05:00.000Z'),
        finishedAt: new Date('2026-08-15T00:05:00.250Z')
      }
    })

    expect(logger.info).toHaveBeenCalledWith(
      {
        event: {
          action: 'scheduler:heartbeat',
          outcome: 'success',
          reference: '2026-08-15T00:05:00.000Z',
          duration: 250_000_000
        }
      },
      'Scheduled job heartbeat completed: 12 active exemptions'
    )
  })

  // Defensive rather than a live path: the real task sets finishedAt before
  // emitting either outcome, so this guards against a shape change in node-cron,
  // not against something that happens today.
  it('omits duration when the execution did not report both timestamps', () => {
    task.emit('execution:finished', {
      date: FIRE_DATE,
      execution: { result: { summary: 'done' } }
    })

    const [fields] = logger.info.mock.calls[0]
    expect(fields.event).not.toHaveProperty('duration')
  })

  it('falls back to a placeholder when a job returns no summary', () => {
    task.emit('execution:finished', { date: FIRE_DATE, execution: {} })

    expect(logger.info).toHaveBeenCalledWith(
      expect.anything(),
      'Scheduled job heartbeat completed: no summary reported'
    )
  })

  it('logs a failure with the ECS error fields and how long it ran for', () => {
    const error = new Error('mongo unavailable')

    task.emit('execution:failed', {
      date: FIRE_DATE,
      execution: {
        error,
        startedAt: new Date('2026-08-15T00:05:00.000Z'),
        finishedAt: new Date('2026-08-15T00:05:01.500Z')
      }
    })

    const [fields, message] = logger.error.mock.calls[0]
    expect(fields.event).toEqual({
      action: 'scheduler:heartbeat',
      outcome: 'failure',
      reference: '2026-08-15T00:05:00.000Z',
      duration: 1_500_000_000
    })
    expect(fields.error.message).toBe('mongo unavailable')
    expect(message).toBe('Scheduled job heartbeat failed')
  })

  it('logs an info line when another instance won the election', () => {
    task.emit('execution:skipped', { date: FIRE_DATE, reason: 'not-elected' })

    expect(logger.info).toHaveBeenCalledWith(
      {
        event: {
          action: 'scheduler:heartbeat',
          outcome: 'unknown',
          reference: '2026-08-15T00:05:00.000Z',
          reason: 'not-elected'
        }
      },
      'Scheduled job heartbeat skipped: another instance is running this fire'
    )
  })

  it('logs an error when the coordinator itself failed', () => {
    task.emit('execution:skipped', {
      date: FIRE_DATE,
      reason: 'coordinator-error'
    })

    expect(logger.error).toHaveBeenCalledWith(
      {
        event: {
          action: 'scheduler:heartbeat',
          outcome: 'failure',
          reference: '2026-08-15T00:05:00.000Z',
          reason: 'coordinator-error'
        }
      },
      'Scheduled job heartbeat skipped: the run coordinator failed, so the run was abandoned to avoid concurrent execution'
    )
  })

  it('warns when a fire was missed entirely', () => {
    task.emit('execution:missed', { date: FIRE_DATE })

    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: {
          action: 'scheduler:heartbeat',
          outcome: 'failure',
          reference: '2026-08-15T00:05:00.000Z',
          reason:
            'Missed fires are not retried; the next scheduled run picks up outstanding work'
        }
      },
      'Scheduled job heartbeat missed its scheduled fire'
    )
  })

  it('warns when a fire was blocked by the previous run still going', () => {
    task.emit('execution:overlap', { date: FIRE_DATE })

    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: {
          action: 'scheduler:heartbeat',
          outcome: 'failure',
          reference: '2026-08-15T00:05:00.000Z',
          reason:
            'Previous run had not finished; this job is running longer than its interval'
        }
      },
      'Scheduled job heartbeat skipped: the previous run was still in progress'
    )
  })
})

describe('logScheduledJobEnabled', () => {
  it('records the job name, its schedule and the timezone it runs in', () => {
    const logger = createLogger()

    logScheduledJobEnabled('heartbeat', '5 0 * * *', 'Europe/London', logger)

    expect(logger.info).toHaveBeenCalledWith(
      {
        event: {
          action: 'scheduler:heartbeat',
          outcome: 'unknown',
          reason: 'Enabled by configuration'
        }
      },
      'Scheduled job heartbeat scheduled: 5 0 * * * (Europe/London)'
    )
  })

  // The schedule varies per job, so keeping it out of event.reason leaves that
  // field with two values across the fleet and therefore still aggregatable.
  it('keeps the varying detail out of event.reason', () => {
    const logger = createLogger()

    logScheduledJobEnabled('heartbeat', '5 0 * * *', 'Europe/London', logger)

    const [fields] = logger.info.mock.calls[0]
    expect(fields.event.reason).not.toContain('5 0 * * *')
  })
})

describe('logScheduledJobDisabled', () => {
  it('records that a job was skipped by configuration', () => {
    const logger = createLogger()

    logScheduledJobDisabled('heartbeat', logger)

    expect(logger.info).toHaveBeenCalledWith(
      {
        event: {
          action: 'scheduler:heartbeat',
          outcome: 'unknown',
          reason: 'Disabled by configuration'
        }
      },
      'Scheduled job heartbeat not scheduled: disabled by configuration'
    )
  })
})
