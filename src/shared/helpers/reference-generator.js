import Boom from '@hapi/boom'

const APPLICATION_TYPES = {
  EXEMPTION: 'EXE',
  MARINE_LICENCE: 'MLA'
}

const SEQUENCE_SEED = 10001
const SEQUENCE_DIGITS = 5

const LOCK_EXHAUSTED_MESSAGE = 'Unable to acquire lock for reference generation'

/**
 * mongo-locks uses insert + unique index: concurrent callers get lock === null
 * immediately (no queue). Multiple backend replicas and parallel submits for the
 * same year contend on one key (reference-generation-{sequenceKey}); bounded retry
 * absorbs short-lived contention without manual resubmit.
 */
export const REFERENCE_LOCK_RETRY_DEFAULTS = Object.freeze({
  /** Upper bound on lock acquisition attempts */
  maxAttempts: 12,
  /** First backoff delay (ms); doubles each retry until maxBackoffMs */
  initialBackoffMs: 35,
  /** Ceiling for a single wait between retries (ms) */
  maxBackoffMs: 200
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function delayMsForAttempt(attemptIndex, { initialBackoffMs, maxBackoffMs }) {
  return Math.min(initialBackoffMs * 2 ** attemptIndex, maxBackoffMs)
}

function mergeLockRetryOptions(lockRetryOptions) {
  return { ...REFERENCE_LOCK_RETRY_DEFAULTS, ...lockRetryOptions }
}

/** Total time spent sleeping between attempts (for Retry-After hint). */
export function totalReferenceLockRetryWaitMs(
  lockRetryOptions = REFERENCE_LOCK_RETRY_DEFAULTS
) {
  const merged = mergeLockRetryOptions(lockRetryOptions)
  const delayCount = Math.max(0, merged.maxAttempts - 1)
  return Array.from({ length: delayCount }, (_, attempt) =>
    delayMsForAttempt(attempt, merged)
  ).reduce((sum, ms) => sum + ms, 0)
}

async function acquireReferenceGenerationLock(
  locker,
  resource,
  lockRetryOptions
) {
  const opts = mergeLockRetryOptions(lockRetryOptions)

  const walk = async (attempt) => {
    const lock = await locker.lock(resource)
    if (lock) {
      return lock
    }
    if (attempt >= opts.maxAttempts - 1) {
      return null
    }
    await sleep(delayMsForAttempt(attempt, opts))
    return walk(attempt + 1)
  }

  return walk(0)
}

/**
 * Generates a unique application reference in the format: PREFIX/YYYY/NNNNN
 *
 * @param {import('mongodb').Db} db
 * @param {{ lock: (key: string) => Promise<unknown> }} locker
 * @param {'EXEMPTION'|'MARINE_LICENCE'} [applicationType]
 * @param {Partial<typeof REFERENCE_LOCK_RETRY_DEFAULTS>} [lockRetryOptions] — override for tests or tuning
 */
export async function generateApplicationReference(
  db,
  locker,
  applicationType = 'EXEMPTION',
  lockRetryOptions = undefined
) {
  const prefix = APPLICATION_TYPES[applicationType]
  if (!prefix) {
    throw Boom.badImplementation(`Unknown application type: ${applicationType}`)
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const sequenceKey = `${applicationType}_${currentYear}`

  const lock = await acquireReferenceGenerationLock(
    locker,
    `reference-generation-${sequenceKey}`,
    lockRetryOptions
  )

  if (!lock) {
    const budgetMs = totalReferenceLockRetryWaitMs(lockRetryOptions)
    const err = Boom.serverUnavailable(LOCK_EXHAUSTED_MESSAGE)
    err.output.headers['Retry-After'] = Math.max(1, Math.ceil(budgetMs / 1000))
    throw err
  }

  try {
    // Shared sequence counter document - one per year/application type combination
    // Upsert creates new document for first application of the year (e.g., EXEMPTION_2025)
    // or finds existing document for subsequent application in the same year
    const sequenceDoc = await db
      .collection('reference-sequences')
      .findOneAndUpdate(
        { key: sequenceKey },
        {
          $setOnInsert: {
            key: sequenceKey,
            currentSequence: SEQUENCE_SEED,
            year: currentYear,
            applicationType,
            createdAt: now
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      )

    const currentSequence = sequenceDoc.currentSequence

    await db.collection('reference-sequences').updateOne(
      { key: sequenceKey },
      {
        $inc: { currentSequence: 1 },
        $set: { lastUpdated: now }
      }
    )

    const formattedSequence = currentSequence
      .toString()
      .padStart(SEQUENCE_DIGITS, '0')

    const reference = `${prefix}/${currentYear}/${formattedSequence}`

    return reference
  } finally {
    await lock.free()
  }
}
