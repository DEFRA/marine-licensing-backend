import { config } from '../../../config.js'
import {
  collectionExemptions,
  collectionEmpQueue
} from '../../../shared/common/constants/db-collections.js'
import {
  EXEMPTION_STATUS,
  SUBMITTED_STATUSES
} from '../../constants/exemption.js'
import { EMP_REQUEST_ACTIONS } from '../../../shared/common/constants/request-queue.js'
import {
  empFeaturesCreated,
  buildEmpQueueItem
} from '../../../shared/common/helpers/emp/emp-queue.js'
import { formatNumber } from '../../../shared/common/helpers/format-number.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { deriveExemptionStatus } from './derive-exemption-status.js'

const BATCH_SIZE = 500

const MISSING_DATES_ACTION = 'exemption-status:missing-activity-dates'

const EMP_QUEUE_AUTHOR = 'exemption-status-job'

const buildSummary = ({ counts, unchanged, emp }) => {
  const parts = [
    `${formatNumber(counts[EXEMPTION_STATUS.SCHEDULED])} scheduled`,
    `${formatNumber(counts[EXEMPTION_STATUS.ACTIVE])} active`,
    `${formatNumber(counts[EXEMPTION_STATUS.EXPIRED])} expired`,
    `${formatNumber(unchanged)} unchanged`
  ]

  if (emp) {
    parts.push(
      `${formatNumber(emp.queued)} queued for EMP`,
      `${formatNumber(emp.notInEmp)} not in EMP`
    )
  }

  return `${formatNumber(counts.updated)} exemptions updated — ${parts.join('; ')}`
}

const logUndatedExemption = (logger, exemption) => {
  const id = exemption._id.toString()

  logger.warn(
    {
      event: {
        action: MISSING_DATES_ACTION,
        outcome: 'failure',
        reference: id,
        reason:
          'Submitted exemption has no usable activity dates, so its status cannot be derived'
      }
    },
    `Cannot derive status for exemption ${id}: no activity dates`
  )
}

const queueEmpStatusUpdates = async (db, applicationReferences) => {
  const collection = db.collection(collectionEmpQueue)
  const now = new Date()
  let queued = 0

  for (
    let index = 0;
    index < applicationReferences.length;
    index += BATCH_SIZE
  ) {
    const chunk = applicationReferences.slice(index, index + BATCH_SIZE)

    const inEmp = await collection.distinct('applicationReferenceNumber', {
      applicationReferenceNumber: { $in: chunk },
      ...empFeaturesCreated
    })

    if (inEmp.length > 0) {
      await collection.insertMany(
        inEmp.map((applicationReference) =>
          buildEmpQueueItem({
            applicationReference,
            action: EMP_REQUEST_ACTIONS.UPDATE_STATUS,
            createdAt: now,
            createdBy: EMP_QUEUE_AUTHOR,
            updatedAt: now,
            updatedBy: EMP_QUEUE_AUTHOR
          })
        )
      )
      queued += inEmp.length
    }
  }

  return queued
}

/**
 * Recomputes the date-derived status of every submitted exemption and writes
 * back the ones that have moved on.
 *
 * Deliberately backward-looking: it queries all outstanding work rather than
 * work that became due since the last run, because a missed fire is never
 * retried. That also makes it self-healing and removes any need to migrate
 * existing records.
 *
 * @param {Object} server - The Hapi server instance, supplying db and logger,
 * and, when EMP is enabled, server.methods.processEmpQueue
 * @param {Date} today - The current date for deriving status
 */
export const updateExemptionStatuses = async (server, today) => {
  const { db, logger } = server
  const collection = db.collection(collectionExemptions)
  const counts = {
    updated: 0,
    [EXEMPTION_STATUS.SCHEDULED]: 0,
    [EXEMPTION_STATUS.ACTIVE]: 0,
    [EXEMPTION_STATUS.EXPIRED]: 0
  }
  let unchanged = 0
  let operations = []
  const changedReferences = []
  const updatedAt = new Date()

  const flush = async () => {
    if (operations.length > 0) {
      await collection.bulkWrite(operations)
      operations = []
    }
  }

  const cursor = collection
    .find({ status: { $in: SUBMITTED_STATUSES } })
    .project({
      _id: 1,
      status: 1,
      applicationReference: 1,
      'siteDetails.activityDates': 1
    })

  for await (const exemption of cursor) {
    const newStatus = deriveExemptionStatus(exemption.siteDetails, today)

    if (newStatus === null) {
      logUndatedExemption(logger, exemption)
    } else if (newStatus === exemption.status) {
      unchanged++
    } else {
      counts.updated++
      counts[newStatus]++
      if (exemption.applicationReference) {
        changedReferences.push(exemption.applicationReference)
      }
      // Compare-and-swap on the status the cursor observed. A withdrawal that
      // lands between the read and the flush changes the status, so this write
      // matches nothing and the withdrawal stands rather than being reverted.
      operations.push({
        updateOne: {
          filter: { _id: exemption._id, status: exemption.status },
          update: { $set: { status: newStatus, updatedAt } }
        }
      })

      if (operations.length >= BATCH_SIZE) {
        await flush()
      }
    }
  }

  await flush()

  const { isEmpEnabled } = config.get('exploreMarinePlanning')

  if (!isEmpEnabled || changedReferences.length === 0) {
    return { summary: buildSummary({ counts, unchanged }) }
  }

  const queued = await queueEmpStatusUpdates(db, changedReferences)

  // fire and forget
  server.methods.processEmpQueue().catch((error) => {
    logger.error(
      structureErrorForECS(error),
      'Failed to process EMP queue after the exemption-status job'
    )
  })

  return {
    summary: buildSummary({
      counts,
      unchanged,
      emp: { queued, notInEmp: changedReferences.length - queued }
    })
  }
}
