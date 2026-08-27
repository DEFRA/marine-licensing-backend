import { vi } from 'vitest'
import { updateExemptionStatuses } from './update-exemption-statuses.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'

const TODAY = new Date('2026-08-25T00:00:00.000Z')

const exemption = (status, start, end) => ({
  status,
  projectName: `${status}-${start}`,
  siteDetails: [
    { activityDates: { start: new Date(start), end: new Date(end) } }
  ]
})

// Stands in for a concurrent writer landing between the cursor read and the
// batched write: the supplied work runs immediately before every flush.
const dbFlushingAfter = (realDb, concurrentWrite) => ({
  collection: (name) => {
    const collection = realDb.collection(name)
    return {
      find: (...args) => collection.find(...args),
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
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  const statusOf = async (projectName) =>
    (await db.collection(collectionExemptions).findOne({ projectName })).status

  it('moves a scheduled exemption to active once its start date arrives', async () => {
    await db
      .collection(collectionExemptions)
      .insertOne(
        exemption(EXEMPTION_STATUS.SCHEDULED, '2026-08-20', '2026-09-30')
      )

    await updateExemptionStatuses(db, TODAY, logger)

    expect(await statusOf('SCHEDULED-2026-08-20')).toBe(EXEMPTION_STATUS.ACTIVE)
  })

  it('moves an active exemption to expired once its end date has passed', async () => {
    await db
      .collection(collectionExemptions)
      .insertOne(exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'))

    await updateExemptionStatuses(db, TODAY, logger)

    expect(await statusOf('ACTIVE-2026-07-01')).toBe(EXEMPTION_STATUS.EXPIRED)
  })

  it('never reconsiders a withdrawn or draft exemption', async () => {
    await db
      .collection(collectionExemptions)
      .insertMany([
        exemption(EXEMPTION_STATUS.WITHDRAWN, '2026-07-01', '2026-08-24'),
        exemption(EXEMPTION_STATUS.DRAFT, '2026-07-01', '2026-08-24')
      ])

    await updateExemptionStatuses(db, TODAY, logger)

    expect(await statusOf('WITHDRAWN-2026-07-01')).toBe(
      EXEMPTION_STATUS.WITHDRAWN
    )
    expect(await statusOf('DRAFT-2026-07-01')).toBe(EXEMPTION_STATUS.DRAFT)
  })

  it('is idempotent: a second run changes nothing', async () => {
    await db
      .collection(collectionExemptions)
      .insertOne(exemption(EXEMPTION_STATUS.ACTIVE, '2026-07-01', '2026-08-24'))

    await updateExemptionStatuses(db, TODAY, logger)
    const second = await updateExemptionStatuses(db, TODAY, logger)

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

    const { summary } = await updateExemptionStatuses(db, TODAY, logger)

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

    await updateExemptionStatuses(
      dbFlushingAfter(db, withdrawDuringFlush),
      TODAY,
      logger
    )

    expect(await statusOf('ACTIVE-2026-07-01')).toBe(EXEMPTION_STATUS.WITHDRAWN)
  })

  it('warns about an exemption with no activity dates instead of skipping silently', async () => {
    await db.collection(collectionExemptions).insertOne({
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'undated',
      siteDetails: [{}]
    })

    await updateExemptionStatuses(db, TODAY, logger)

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'exemption-status:missing-activity-dates'
        })
      }),
      expect.any(String)
    )
  })
})
