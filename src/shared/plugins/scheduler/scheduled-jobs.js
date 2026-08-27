import { collectionExemptions } from '../../common/constants/db-collections.js'
import { EXEMPTION_STATUS } from '../../../exemptions/constants/exemption.js'
import { londonToday } from '../../common/helpers/london-today.js'
import { updateExemptionStatuses } from '../../../exemptions/api/helpers/update-exemption-statuses.js'
import { formatNumber } from '../../common/helpers/format-number.js'

/**
 * Every scheduled job is declared here.
 *
 * - `name` forms the node-cron coordination key (`<name>:<fireTime>`) and the
 *   `event.action` suffix, so it must be unique and stable. It also needs a
 *   matching entry under `scheduler.jobs` in `src/config/scheduler.js` — without
 *   one the service fails to start.
 * - `methodName` is the Hapi server method the job body is exposed as, so it
 *   can be triggered by hand even when scheduling is disabled.
 * - `run` must be idempotent and backward-looking: a missed fire is never
 *   retried, so a job must query for all outstanding work rather than for work
 *   that arrived since the previous run.
 * - `run` must not block the event loop. CDP kills an instance whose /health
 *   endpoint stops responding.
 * - `run` should resolve to `{ summary }`; the summary is the human-readable
 *   part of the completion log line.
 */
const HEARTBEAT_STATUS_ORDER = [
  [EXEMPTION_STATUS.SCHEDULED, 'scheduled'],
  [EXEMPTION_STATUS.ACTIVE, 'active'],
  [EXEMPTION_STATUS.EXPIRED, 'expired'],
  [EXEMPTION_STATUS.DRAFT, 'draft'],
  [EXEMPTION_STATUS.WITHDRAWN, 'withdrawn']
]

// Rendered from the known status list rather than from the query result, so a
// status with no documents reports 0 instead of vanishing from the line.
const buildHeartbeatSummary = (groupedCounts) => {
  const countsByStatus = Object.fromEntries(
    groupedCounts.map(({ _id, count }) => [_id, count])
  )
  const total = groupedCounts.reduce((sum, { count }) => sum + count, 0)
  const breakdown = HEARTBEAT_STATUS_ORDER.map(
    ([status, label]) => `${formatNumber(countsByStatus[status] ?? 0)} ${label}`
  ).join('; ')

  return `${formatNumber(total)} exemptions — ${breakdown}`
}

export const scheduledJobs = [
  {
    name: 'heartbeat',
    methodName: 'runSchedulerHeartbeat',
    run: async (server) => {
      const groupedCounts = await server.db
        .collection(collectionExemptions)
        .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
        .toArray()

      return { summary: buildHeartbeatSummary(groupedCounts) }
    }
  },
  {
    name: 'exemption-status',
    methodName: 'runSchedulerExemptionStatus',
    run: async (server) =>
      updateExemptionStatuses(server.db, londonToday(), server.logger)
  }
]
