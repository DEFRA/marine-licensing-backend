import { structureErrorForECS } from '../../common/helpers/logging/logger.js'

const jobAction = (jobName) => `scheduler:${jobName}`

const MISSED_FIRE_REASON =
  'Missed fires are not retried; the next scheduled run picks up outstanding work'

const OVERLAP_REASON =
  'Previous run had not finished; this job is running longer than its interval'

const NANOSECONDS_PER_MILLISECOND = 1_000_000

// ECS defines event.duration as nanoseconds, and it is one of the fields CDP
// lets tenants set.
const durationNs = ({ startedAt, finishedAt } = {}) =>
  startedAt && finishedAt
    ? (finishedAt - startedAt) * NANOSECONDS_PER_MILLISECOND
    : undefined

const withDuration = (event, execution) => {
  const duration = durationNs(execution)
  return duration === undefined ? event : { ...event, duration }
}

export const attachScheduledJobLogging = (task, jobName, logger) => {
  task.on('execution:started', ({ date }) => {
    logger.info(
      {
        event: {
          action: jobAction(jobName),
          outcome: 'unknown',
          reference: date.toISOString()
        }
      },
      `Scheduled job ${jobName} started`
    )
  })

  task.on('execution:finished', ({ date, execution }) => {
    logger.info(
      {
        event: withDuration(
          {
            action: jobAction(jobName),
            outcome: 'success',
            reference: date.toISOString()
          },
          execution
        )
      },
      `Scheduled job ${jobName} completed: ${execution?.result?.summary ?? 'no summary reported'}`
    )
  })

  task.on('execution:failed', ({ date, execution }) => {
    logger.error(
      {
        ...structureErrorForECS(execution?.error),
        event: withDuration(
          {
            action: jobAction(jobName),
            outcome: 'failure',
            reference: date.toISOString()
          },
          execution
        )
      },
      `Scheduled job ${jobName} failed`
    )
  })

  task.on('execution:skipped', ({ date, reason }) => {
    if (reason === 'coordinator-error') {
      logger.error(
        {
          event: {
            action: jobAction(jobName),
            outcome: 'failure',
            reference: date.toISOString(),
            reason
          }
        },
        `Scheduled job ${jobName} skipped: the run coordinator failed, so the run was abandoned to avoid concurrent execution`
      )
      return
    }

    logger.info(
      {
        event: {
          action: jobAction(jobName),
          outcome: 'unknown',
          reference: date.toISOString(),
          reason
        }
      },
      `Scheduled job ${jobName} skipped: another instance is running this fire`
    )
  })

  // Attaching this listener also suppresses node-cron's own console warning.
  task.on('execution:missed', ({ date }) => {
    logger.warn(
      {
        event: {
          action: jobAction(jobName),
          outcome: 'failure',
          reference: date.toISOString(),
          reason: MISSED_FIRE_REASON
        }
      },
      `Scheduled job ${jobName} missed its scheduled fire`
    )
  })

  // `noOverlap: true` blocks the fire rather than queueing it. node-cron logs
  // its own warning for this, but unstructured — hence a proper ECS line here.
  task.on('execution:overlap', ({ date }) => {
    logger.warn(
      {
        event: {
          action: jobAction(jobName),
          outcome: 'failure',
          reference: date.toISOString(),
          reason: OVERLAP_REASON
        }
      },
      `Scheduled job ${jobName} skipped: the previous run was still in progress`
    )
  })
}

export const logScheduledJobEnabled = (jobName, schedule, timezone, logger) => {
  logger.info(
    {
      event: {
        action: jobAction(jobName),
        outcome: 'unknown',
        reason: 'Enabled by configuration'
      }
    },
    `Scheduled job ${jobName} scheduled: ${schedule} (${timezone})`
  )
}

export const logScheduledJobDisabled = (jobName, logger) => {
  logger.info(
    {
      event: {
        action: jobAction(jobName),
        outcome: 'unknown',
        reason: 'Disabled by configuration'
      }
    },
    `Scheduled job ${jobName} not scheduled: disabled by configuration`
  )
}
