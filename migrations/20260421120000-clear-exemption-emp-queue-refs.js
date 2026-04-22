import { config } from '../src/config.js'
import { upClearExemptionEmpQueue } from './helpers/exemption-emp-queue-refs-migration.js'

/**
 * When this migration is applied (see `changelog`), removes rows from
 * `exemption-emp-queue` whose `applicationReferenceNumber` is in the list resolved
 * from `exploreMarinePlanning.clearExemptionEmpQueueRefsForMigration` (or another
 * path if env `MIGRATION_EMP_QUEUE_REFS_CONFIG_PATH` is set). See
 * `migrations/helpers/exemption-emp-queue-refs-migration.js` and `src/config.js`.
 *
 * If the resolved list is empty, the migration is a no-op. For another batch later,
 * add a new migration (or a manual MongoDB delete); migrate-mongo does not re-run
 * an already-applied `up` function.
 */
export const up = (db) =>
  upClearExemptionEmpQueue(db, { configGet: (p) => config.get(p) })

export const down = async () => {}
