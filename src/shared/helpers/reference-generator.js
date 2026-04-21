import Boom from '@hapi/boom'

const APPLICATION_TYPES = {
  EXEMPTION: 'EXE',
  MARINE_LICENCE: 'MLA'
}

const SEQUENCE_SEED = 10001
const SEQUENCE_DIGITS = 5

/**
 * Allocates the next application reference using a single atomic
 * `findOneAndUpdate` (aggregation pipeline). Documents keep `currentSequence` as
 * the **next** value to hand out (same as the legacy lock-based implementation):
 * after each call the stored counter is `issued + 1`, and `issued` is
 * `currentSequence - 1` on the returned document.
 *
 * @param {import('mongodb').Db} db
 * @param {'EXEMPTION'|'MARINE_LICENCE'} [applicationType]
 * @param {{ session?: import('mongodb').ClientSession }} [options]
 * @returns {Promise<string>} Reference formatted PREFIX/YYYY/NNNNN
 */
export async function generateApplicationReference(
  db,
  applicationType = 'EXEMPTION',
  options = {}
) {
  const { session } = options
  const prefix = APPLICATION_TYPES[applicationType]
  if (!prefix) {
    throw Boom.badImplementation(`Unknown application type: ${applicationType}`)
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const sequenceKey = `${applicationType}_${currentYear}`

  const findOptions = {
    upsert: true,
    returnDocument: 'after'
  }
  if (session) {
    findOptions.session = session
  }

  // Pipeline avoids MongoDB forbidding $inc and $setOnInsert on the same path.
  const coll = db.collection('reference-sequences')
  const result = await coll.findOneAndUpdate(
    { key: sequenceKey },
    [
      {
        $set: {
          currentSequence: {
            $add: [{ $ifNull: ['$currentSequence', SEQUENCE_SEED] }, 1]
          },
          lastUpdated: now,
          year: { $ifNull: ['$year', currentYear] },
          applicationType: { $ifNull: ['$applicationType', applicationType] },
          key: { $ifNull: ['$key', sequenceKey] },
          createdAt: { $ifNull: ['$createdAt', now] }
        }
      }
    ],
    findOptions
  )

  // Pipeline upserts may not populate `value` in all server/driver combinations; read within the same session.
  let doc = result.value
  if (!doc) {
    doc = await coll.findOne({ key: sequenceKey }, { session })
  }
  const nextPointer = doc?.currentSequence
  if (nextPointer === undefined || nextPointer === null) {
    throw Boom.badImplementation(
      'Reference sequence update returned no document'
    )
  }

  const issued = nextPointer - 1
  const formattedSequence = issued.toString().padStart(SEQUENCE_DIGITS, '0')

  return `${prefix}/${currentYear}/${formattedSequence}`
}
