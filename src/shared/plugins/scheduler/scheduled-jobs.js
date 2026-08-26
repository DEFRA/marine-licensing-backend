import { collectionExemptions } from '../../common/constants/db-collections.js'
import { EXEMPTION_STATUS } from '../../../exemptions/constants/exemption.js'
import { londonToday } from '../../common/helpers/london-today.js'
import { updateExemptionStatuses } from '../../../exemptions/api/helpers/update-exemption-statuses.js'

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
export const scheduledJobs = [
  {
    name: 'heartbeat',
    methodName: 'runSchedulerHeartbeat',
    run: async (server) => {
      const activeCount = await server.db
        .collection(collectionExemptions)
        .countDocuments({ status: EXEMPTION_STATUS.ACTIVE })

      return { summary: `${activeCount} active exemptions` }
    }
  },
  {
    name: 'exemption-status',
    methodName: 'runSchedulerExemptionStatus',
    run: async (server) =>
      updateExemptionStatuses(server.db, londonToday(), server.logger)
  }
]
