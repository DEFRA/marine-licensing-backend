import { vi } from 'vitest'
import {
  createScheduledJobRunCoordinator,
  RUN_RECORD_TTL_MS
} from './scheduled-job-run-coordinator.js'
import { collectionScheduledJobRuns } from '../../common/constants/db-collections.js'
import { MONGO_DUPLICATE_KEY_CODE } from '../../common/constants/mongo.js'

const duplicateKeyError = () =>
  Object.assign(new Error('duplicate'), { code: MONGO_DUPLICATE_KEY_CODE })

describe('createScheduledJobRunCoordinator', () => {
  let collection
  let db
  let logger

  beforeEach(() => {
    collection = { insertOne: vi.fn() }
    db = { collection: vi.fn().mockReturnValue(collection) }
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  describe('shouldRun', () => {
    it('claims an unclaimed fire and allows the run', async () => {
      collection.insertOne.mockResolvedValue({ acknowledged: true })

      const allowed = await createScheduledJobRunCoordinator(
        db,
        logger
      ).shouldRun('heartbeat:2026-08-15T00:05:00.000Z')

      expect(allowed).toBe(true)
      expect(db.collection).toHaveBeenCalledWith(collectionScheduledJobRuns)
      expect(collection.insertOne).toHaveBeenCalledWith({
        _id: 'heartbeat:2026-08-15T00:05:00.000Z',
        claimedAt: expect.any(Date),
        expiresAt: expect.any(Date)
      })
    })

    it('expires the record RUN_RECORD_TTL_MS after it is written', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-15T00:05:00.000Z'))
      collection.insertOne.mockResolvedValue({ acknowledged: true })

      await createScheduledJobRunCoordinator(db, logger).shouldRun(
        'heartbeat:x'
      )

      const { expiresAt } = collection.insertOne.mock.calls[0][0]
      expect(expiresAt.getTime()).toBe(
        new Date('2026-08-15T00:05:00.000Z').getTime() + RUN_RECORD_TTL_MS
      )

      vi.useRealTimers()
    })

    it('ignores any lease hint node-cron passes, owning its own window', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-15T00:05:00.000Z'))
      collection.insertOne.mockResolvedValue({ acknowledged: true })

      // node-cron calls shouldRun(key, coordinatorTtl); the interface marks that
      // second argument advisory, and this coordinator is not lease-based.
      await createScheduledJobRunCoordinator(db, logger).shouldRun(
        'heartbeat:x',
        30_000
      )

      const { expiresAt } = collection.insertOne.mock.calls[0][0]
      expect(expiresAt.getTime()).toBe(
        new Date('2026-08-15T00:05:00.000Z').getTime() + RUN_RECORD_TTL_MS
      )

      vi.useRealTimers()
    })

    it('declines the run when another instance already claimed the fire', async () => {
      collection.insertOne.mockRejectedValue(duplicateKeyError())

      const coordinator = createScheduledJobRunCoordinator(db, logger)
      const allowed = await coordinator.shouldRun(
        'heartbeat:2026-08-15T00:05:00.000Z'
      )

      expect(allowed).toBe(false)
      // Losing the election is the normal case on every instance but one, so it
      // must not look like an error.
      expect(logger.error).not.toHaveBeenCalled()
    })

    it('rethrows non-duplicate errors so node-cron fails closed', async () => {
      collection.insertOne.mockRejectedValue(new Error('connection lost'))

      await expect(
        createScheduledJobRunCoordinator(db, logger).shouldRun('heartbeat:x')
      ).rejects.toThrow('connection lost')
    })

    // node-cron catches this, logs it unstructured and emits execution:skipped
    // with reason 'coordinator-error' — but the context it emits carries no
    // error, so this is the only place the cause can reach ECS error fields.
    it('logs the cause in ECS error fields before rethrowing', async () => {
      collection.insertOne.mockRejectedValue(new Error('connection lost'))

      await expect(
        createScheduledJobRunCoordinator(db, logger).shouldRun('heartbeat:x')
      ).rejects.toThrow('connection lost')

      const [fields, message] = logger.error.mock.calls[0]
      expect(fields.error.message).toBe('connection lost')
      expect(message).toBe(
        'Scheduled job run coordinator failed for heartbeat:x'
      )
    })

    it('does not release the claim, so a late instance cannot re-run the same fire', async () => {
      collection.insertOne
        .mockResolvedValueOnce({ acknowledged: true })
        .mockRejectedValueOnce(duplicateKeyError())

      const coordinator = createScheduledJobRunCoordinator(db, logger)
      const key = 'heartbeat:2026-08-15T00:05:00.000Z'

      expect(await coordinator.shouldRun(key)).toBe(true)
      expect(await coordinator.shouldRun(key)).toBe(false)
      expect(coordinator.onComplete).toBeUndefined()
    })
  })
})
