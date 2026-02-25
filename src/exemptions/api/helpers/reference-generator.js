import Boom from '@hapi/boom'

const APPLICATION_TYPES = {
  EXEMPTION: 'EXE'
}

const SEQUENCE_SEED = 10001
const SEQUENCE_DIGITS = 5

/**
 * Generates a unique application reference in the format: PREFIX/YYYY/NNNNN
 */
export async function generateApplicationReference(
  db,
  locker,
  applicationType = 'EXEMPTION'
) {
  const prefix = APPLICATION_TYPES[applicationType]
  if (!prefix) {
    throw Boom.badImplementation(`Unknown application type: ${applicationType}`)
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const sequenceKey = `${applicationType}_${currentYear}`

  const lock = await locker.lock(`reference-generation-${sequenceKey}`)

  if (!lock) {
    throw Boom.internal('Unable to acquire lock for reference generation')
  }

  try {
    // Shared sequence counter document - one per year/application type combination
    // Upsert creates new document for first exemption of the year (e.g., EXEMPTION_2025)
    // or finds existing document for subsequent exemptions in the same year
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
