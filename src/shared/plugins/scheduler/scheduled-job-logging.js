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

const runEvent = (jobName, outcome, date, extra) => ({
  action: jobAction(jobName),
  outcome,
  reference: date.toISOString(),
  ...extra
})

const onStarted = (jobName, logger) => (context) => {
  logger.info(
    { event: runEvent(jobName, 'unknown', context.date) },
    `Scheduled job ${jobName} started`
  )
}

const onFinished =
  (jobName, logger) =>
  ({ date, execution }) => {
    logger.info(
      { event: withDuration(runEvent(jobName, 'success', date), execution) },
      `Scheduled job ${jobName} completed: ${execution?.result?.summary ?? 'no summary reported'}`
    )
  }

const onFailed =
  (jobName, logger) =>
  ({ date, execution }) => {
    logger.error(
      {
        ...structureErrorForECS(execution?.error),
        event: withDuration(runEvent(jobName, 'failure', date), execution)
      },
      `Scheduled job ${jobName} failed`
    )
  }

const onSkipped =
  (jobName, logger) =>
  ({ date, reason }) => {
    if (reason === 'coordinator-error') {
      logger.error(
        { event: runEvent(jobName, 'failure', date, { reason }) },
        `Scheduled job ${jobName} skipped: the run coordinator failed, so the run was abandoned to avoid concurrent execution`
      )
      return
    }

    logger.info(
      { event: runEvent(jobName, 'unknown', date, { reason }) },
      `Scheduled job ${jobName} skipped: another instance is running this fire`
    )
  }

const onMissed = (jobName, logger) => (context) => {
  logger.warn(
    {
      event: runEvent(jobName, 'failure', context.date, {
        reason: MISSED_FIRE_REASON
      })
    },
    `Scheduled job ${jobName} missed its scheduled fire`
  )
}

const onOverlap = (jobName, logger) => (context) => {
  logger.warn(
    {
      event: runEvent(jobName, 'failure', context.date, {
        reason: OVERLAP_REASON
      })
    },
    `Scheduled job ${jobName} skipped: the previous run was still in progress`
  )
}

export const attachScheduledJobLogging = (task, jobName, logger) => {
  task.on('execution:started', onStarted(jobName, logger))
  task.on('execution:finished', onFinished(jobName, logger))
  task.on('execution:failed', onFailed(jobName, logger))
  task.on('execution:skipped', onSkipped(jobName, logger))

  // Attaching this listener also suppresses node-cron's own console warning.
  task.on('execution:missed', onMissed(jobName, logger))

  // `noOverlap: true` blocks the fire rather than queueing it. node-cron logs
  // its own warning for this, but unstructured — hence a proper ECS line here.
  task.on('execution:overlap', onOverlap(jobName, logger))
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
