import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import {
  EXEMPTION_STATUS,
  SUBMITTED_STATUSES
} from '../../constants/exemption.js'
import { formatNumber } from '../../../shared/common/helpers/format-number.js'
import { deriveExemptionStatus } from './derive-exemption-status.js'

const BATCH_SIZE = 500

const MISSING_DATES_ACTION = 'exemption-status:missing-activity-dates'

const buildSummary = ({ counts, unchanged }) =>
  `${formatNumber(counts.updated)} exemptions updated — ${[
    `${formatNumber(counts[EXEMPTION_STATUS.SCHEDULED])} scheduled`,
    `${formatNumber(counts[EXEMPTION_STATUS.ACTIVE])} active`,
    `${formatNumber(counts[EXEMPTION_STATUS.EXPIRED])} expired`,
    `${formatNumber(unchanged)} unchanged`
  ].join('; ')}`

/**
 * Recomputes the date-derived status of every submitted exemption and writes
 * back the ones that have moved on.
 *
 * Deliberately backward-looking: it queries all outstanding work rather than
 * work that became due since the last run, because a missed fire is never
 * retried. That also makes it self-healing and removes any need to migrate
 * existing records.
 */
export const updateExemptionStatuses = async (db, today, logger) => {
  const collection = db.collection(collectionExemptions)
  const counts = {
    updated: 0,
    [EXEMPTION_STATUS.SCHEDULED]: 0,
    [EXEMPTION_STATUS.ACTIVE]: 0,
    [EXEMPTION_STATUS.EXPIRED]: 0
  }
  let unchanged = 0
  let operations = []
  const updatedAt = new Date()

  const flush = async () => {
    if (operations.length > 0) {
      await collection.bulkWrite(operations)
      operations = []
    }
  }

  const cursor = collection
    .find({ status: { $in: SUBMITTED_STATUSES } })
    .project({ _id: 1, status: 1, 'siteDetails.activityDates': 1 })

  for await (const exemption of cursor) {
    const newStatus = deriveExemptionStatus(exemption.siteDetails, today)

    if (newStatus === null) {
      logger.warn(
        {
          event: {
            action: MISSING_DATES_ACTION,
            outcome: 'failure',
            reference: exemption._id.toString(),
            reason:
              'Submitted exemption has no usable activity dates, so its status cannot be derived'
          }
        },
        `Cannot derive status for exemption ${exemption._id.toString()}: no activity dates`
      )
      continue
    }

    if (newStatus === exemption.status) {
      unchanged++
      continue
    }

    counts.updated++
    counts[newStatus]++
    operations.push({
      updateOne: {
        filter: { _id: exemption._id },
        update: { $set: { status: newStatus, updatedAt } }
      }
    })

    if (operations.length >= BATCH_SIZE) {
      await flush()
    }
  }

  await flush()

  return { summary: buildSummary({ counts, unchanged }) }
}
