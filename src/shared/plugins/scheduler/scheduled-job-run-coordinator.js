import { collectionScheduledJobRuns } from '../../common/constants/db-collections.js'
import { MONGO_DUPLICATE_KEY_CODE } from '../../common/constants/mongo.js'
import { structureErrorForECS } from '../../common/helpers/logging/logger.js'

// Garbage collection horizon, not a lease. A fire is claimed once, the claim is
// never released, and nothing is refreshed — so no claim can expire underneath a
// running job however long it runs.
//
// The window only has to outlast the clock skew between instances: each instance
// derives the slot from its own clock, so an instance more than this far behind
// the winner would find the record already reaped and run the same fire again.
// Five minutes is orders of magnitude beyond NTP-synced skew.
//
// Deliberately not configurable. A job that would want a longer window is a job
// that should not be sharing the API's event loop at all — it belongs in a
// dedicated scheduled-job service. See docs/scheduled-jobs.md.
export const RUN_RECORD_TTL_MS = 5 * 60 * 1000

/**
 * Builds the node-cron `RunCoordinator` that elects a single instance per
 * scheduled fire.
 *
 * node-cron builds the key as `<jobName>:<slotIsoString>`, so a claim is unique
 * to one fire of one job. The claim is deliberately never released: releasing it
 * would let a second instance whose timer drifted — but which is still inside
 * node-cron's `missedExecutionTolerance` — claim the same fire and run it again.
 * A MongoDB TTL index on `expiresAt` reaps claims instead.
 *
 * Because nothing is held open, there is no lock to strand when an instance is
 * killed mid-deployment.
 *
 * `RunCoordinator` is a structural TypeScript interface, not a base class —
 * node-cron only reads `.shouldRun` off whatever object it is given. A closure
 * over the dependencies is therefore enough, matches the factory style used
 * elsewhere in this codebase (`helpers/sqs/create-poller-plugin.js`), and has no
 * `this` to lose if the method is ever destructured or passed as a callback.
 */
export const createScheduledJobRunCoordinator = (db, logger) => ({
  /**
   * @returns true when this instance won the election for `key`. Throws on any
   * error other than a duplicate claim; node-cron treats a throw as fail-closed
   * and skips the run rather than risking a concurrent execution.
   */
  async shouldRun(key) {
    try {
      await db.collection(collectionScheduledJobRuns).insertOne({
        _id: key,
        claimedAt: new Date(),
        expiresAt: new Date(Date.now() + RUN_RECORD_TTL_MS)
      })
      return true
    } catch (err) {
      if (err?.code === MONGO_DUPLICATE_KEY_CODE) {
        return false
      }

      // node-cron catches this, logs it unstructured and emits
      // execution:skipped with reason 'coordinator-error' — but the context it
      // emits carries no error, so this is the only place the cause reaches ECS
      // error fields.
      logger.error(
        structureErrorForECS(err),
        `Scheduled job run coordinator failed for ${key}`
      )
      throw err
    }
  }
})
