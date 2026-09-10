import { vi } from 'vitest'
import { updateExemptionStatuses } from './update-exemption-statuses.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import {
  collectionExemptions,
  collectionEmpQueue
} from '../../../shared/common/constants/db-collections.js'
import { config } from '../../../config.js'
import { EMP_REQUEST_ACTIONS } from '../../../shared/common/constants/request-queue.js'

vi.mock('../../../config.js')

const TODAY = new Date('2026-08-25T00:00:00.000Z')

const exemption = (status, start, end) => ({
  status,
  projectName: `${status}-${start}`,
  siteDetails: [
    { activityDates: { start: new Date(start), end: new Date(end) } }
  ]
})

// Records the size of every batched write, so a test can assert the mid-loop
// flush fires rather than everything landing in one final write.
const dbRecordingFlushes = (realDb, batchSizes) => ({
  collection: (name) => {
    const collection = realDb.collection(name)
    return {
      find: (...args) => collection.find(...args),
      distinct: (...args) => collection.distinct(...args),
      insertMany: (...args) => collection.insertMany(...args),
      bulkWrite: (operations) => {
        batchSizes.push(operations.length)
        return collection.bulkWrite(operations)
      }
    }
  }
})

// Stands in for a concurrent writer landing between the cursor read and the
// batched write: the supplied work runs immediately before every flush.
const dbFlushingAfter = (realDb, concurrentWrite) => ({
  collection: (name) => {
    const collection = realDb.collection(name)
    return {
      find: (...args) => collection.find(...args),
      distinct: (...args) => collection.distinct(...args),
      insertMany: (...args) => collection.insertMany(...args),
      bulkWrite: async (operations) => {
        await concurrentWrite()
        return collection.bulkWrite(operations)
      }
    }
  }
})

describe('updateExemptionStatuses', () => {
  let db
  let logger

  beforeEach(async () => {
    db = globalThis.mockMongo
    await db.collection(collectionExemptions).deleteMany({})
    config.get.mockReturnValue({ isEmpEnabled: false })
    await db.collection(collectionEmpQueue).deleteMany({})
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  const statusOf = async (projectName) =>
    (await db.collection(collectionExemptions).findOne({ projectName })).status

  const runJob = (dbOverride = db) =>
    updateExemptionStatuses({ db: dbOverride, logger }, TODAY)

  it('moves a scheduled exemption to active once its start date arrives', async () => {
    await db
      .collection(collectionExemptions)
      .insertOne(
        exemption(EXEMPTION_STATUS.SCHEDULED, '2026-08-20', '2026-09-30')
      )

    await runJob()

    expect(await statusOf('SCHEDULED-2026-08-20')).toBe(EXEMPTION_STATUS.ACTIVE)
  })

  it('moves an active exemption to expired once its end date has passed', async () => {
    await db
      .collection(collectionExemptions)
      .insertOne(exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'))

    await runJob()

    expect(await statusOf('ACTIVE-2026-07-01')).toBe(EXEMPTION_STATUS.EXPIRED)
  })

  it('never reconsiders a withdrawn or draft exemption', async () => {
    await db
      .collection(collectionExemptions)
      .insertMany([
        exemption(EXEMPTION_STATUS.WITHDRAWN, '2026-07-01', '2026-08-24'),
        exemption(EXEMPTION_STATUS.DRAFT, '2026-07-01', '2026-08-24')
      ])

    await runJob()

    expect(await statusOf('WITHDRAWN-2026-07-01')).toBe(
      EXEMPTION_STATUS.WITHDRAWN
    )
    expect(await statusOf('DRAFT-2026-07-01')).toBe(EXEMPTION_STATUS.DRAFT)
  })

  it('is idempotent: a second run changes nothing', async () => {
    await db
      .collection(collectionExemptions)
      .insertOne(exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'))

    await runJob()
    const second = await runJob()

    expect(second.summary).toContain('0 exemptions updated')
    expect(await statusOf('ACTIVE-2026-07-01')).toBe(EXEMPTION_STATUS.EXPIRED)
  })

  it('reports counts in the summary for the completion log line', async () => {
    await db
      .collection(collectionExemptions)
      .insertMany([
        exemption(EXEMPTION_STATUS.SCHEDULED, '2026-08-20', '2026-09-30'),
        exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'),
        exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-09-30')
      ])

    const { summary } = await runJob()

    expect(summary).toBe(
      '2 exemptions updated — 0 scheduled; 1 active; 1 expired; 1 unchanged'
    )
  })

  it('leaves an exemption alone when its status changed between the read and the flush', async () => {
    await db
      .collection(collectionExemptions)
      .insertOne(exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'))

    const withdrawDuringFlush = async () => {
      await db
        .collection(collectionExemptions)
        .updateOne(
          { projectName: 'ACTIVE-2026-07-01' },
          { $set: { status: EXEMPTION_STATUS.WITHDRAWN } }
        )
    }

    await runJob(dbFlushingAfter(db, withdrawDuringFlush))

    expect(await statusOf('ACTIVE-2026-07-01')).toBe(EXEMPTION_STATUS.WITHDRAWN)
  })

  it('writes in batches and loses nothing across a batch boundary', async () => {
    const total = 501
    const documents = Array.from({ length: total }, (_, index) => ({
      ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'),
      projectName: `batched-${index}`
    }))
    await db.collection(collectionExemptions).insertMany(documents)

    const batchSizes = []

    const { summary } = await runJob(dbRecordingFlushes(db, batchSizes))

    // One full batch mid-loop, then the remainder flushed after it.
    expect(batchSizes).toEqual([500, 1])
    expect(
      await db
        .collection(collectionExemptions)
        .countDocuments({ status: EXEMPTION_STATUS.EXPIRED })
    ).toBe(total)
    expect(summary).toContain('501 exemptions updated')
  })

  it('warns about an exemption with no activity dates instead of skipping silently', async () => {
    await db.collection(collectionExemptions).insertOne({
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'undated',
      siteDetails: [{}]
    })

    await runJob()

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'exemption-status:missing-activity-dates'
        })
      }),
      expect.any(String)
    )
  })

  describe('EMP status updates', () => {
    let processEmpQueue

    const runWithEmpEnabled = (dbOverride = db) => {
      config.get.mockReturnValue({ isEmpEnabled: true })
      processEmpQueue = vi.fn().mockResolvedValue(undefined)
      return updateExemptionStatuses(
        { db: dbOverride, logger, methods: { processEmpQueue } },
        TODAY
      )
    }

    const sentToEmp = (applicationReference) => ({
      applicationReferenceNumber: applicationReference,
      action: EMP_REQUEST_ACTIONS.ADD,
      empFeatureIds: ['emp-object-id']
    })

    const queuedStatusUpdates = async () =>
      (
        await db
          .collection(collectionEmpQueue)
          .find({ action: EMP_REQUEST_ACTIONS.UPDATE_STATUS })
          .toArray()
      ).map((row) => row.applicationReferenceNumber)

    it('queues an update for a changed exemption that has reached EMP', async () => {
      await db.collection(collectionExemptions).insertOne({
        ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'),
        applicationReference: 'IN-EMP'
      })
      await db.collection(collectionEmpQueue).insertOne(sentToEmp('IN-EMP'))

      await runWithEmpEnabled()

      expect(await queuedStatusUpdates()).toEqual(['IN-EMP'])
    })

    it('queues nothing for a changed exemption that never reached EMP', async () => {
      await db.collection(collectionExemptions).insertOne({
        ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'),
        applicationReference: 'NEVER-SENT'
      })

      await runWithEmpEnabled()

      expect(await queuedStatusUpdates()).toEqual([])
    })

    it('queues nothing when the status did not change', async () => {
      await db.collection(collectionExemptions).insertOne({
        ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-09-30'),
        applicationReference: 'UNCHANGED'
      })
      await db.collection(collectionEmpQueue).insertOne(sentToEmp('UNCHANGED'))

      await runWithEmpEnabled()

      expect(await queuedStatusUpdates()).toEqual([])
    })

    it('writes a pending row authored by the job', async () => {
      await db.collection(collectionExemptions).insertOne({
        ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'),
        applicationReference: 'IN-EMP'
      })
      await db.collection(collectionEmpQueue).insertOne(sentToEmp('IN-EMP'))

      await runWithEmpEnabled()

      const [row] = await db
        .collection(collectionEmpQueue)
        .find({ action: EMP_REQUEST_ACTIONS.UPDATE_STATUS })
        .toArray()

      expect(row).toMatchObject({
        applicationReferenceNumber: 'IN-EMP',
        status: 'pending',
        retries: 0,
        createdBy: 'exemption-status-job',
        updatedBy: 'exemption-status-job'
      })
      expect(row.createdAt).toBeInstanceOf(Date)
    })

    it('kicks the poller once rather than once per exemption', async () => {
      await db.collection(collectionExemptions).insertMany([
        {
          ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'),
          applicationReference: 'IN-EMP-1'
        },
        {
          ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-02', '2026-08-24'),
          applicationReference: 'IN-EMP-2'
        }
      ])
      await db
        .collection(collectionEmpQueue)
        .insertMany([sentToEmp('IN-EMP-1'), sentToEmp('IN-EMP-2')])

      await runWithEmpEnabled()

      expect(processEmpQueue).toHaveBeenCalledTimes(1)
    })

    it('reports the EMP figures in the summary', async () => {
      await db.collection(collectionExemptions).insertMany([
        {
          ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'),
          applicationReference: 'IN-EMP'
        },
        {
          ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-02', '2026-08-24'),
          applicationReference: 'NEVER-SENT'
        }
      ])
      await db.collection(collectionEmpQueue).insertOne(sentToEmp('IN-EMP'))

      const { summary } = await runWithEmpEnabled()

      expect(summary).toBe(
        '2 exemptions updated — 0 scheduled; 0 active; 2 expired; 0 unchanged; 1 queued for EMP; 1 not in EMP'
      )
    })

    it('touches neither the queue nor the server methods when EMP is disabled', async () => {
      await db.collection(collectionExemptions).insertOne({
        ...exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'),
        applicationReference: 'IN-EMP'
      })
      await db.collection(collectionEmpQueue).insertOne(sentToEmp('IN-EMP'))

      const { summary } = await updateExemptionStatuses({ db, logger }, TODAY)

      expect(await queuedStatusUpdates()).toEqual([])
      expect(summary).toBe(
        '1 exemptions updated — 0 scheduled; 0 active; 1 expired; 0 unchanged'
      )
    })
  })
})
