import { blobService } from '../../../shared/services/data-service/blob-service.js'
import {
  createLogger,
  structureErrorForECS
} from '../../../shared/common/helpers/logging/logger.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

const logger = createLogger()
const logSystem = 'MarineLicence:DeleteS3Objects'

const isS3Location = (value) =>
  typeof value?.s3Bucket === 'string' && typeof value?.s3Key === 'string'

/**
 * Walks a construction drawing or an array of them and returns every
 * well-formed s3Location it holds. Drawings without an s3Location (the empty
 * placeholder pushed by add-construction-drawing) are simply skipped.
 */
export const collectS3Locations = (source) => {
  const locations = []

  const walk = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }

    if (value === null || typeof value !== 'object') {
      return
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === 's3Location' && isS3Location(child)) {
        locations.push({ s3Bucket: child.s3Bucket, s3Key: child.s3Key })
      } else {
        walk(child)
      }
    }
  }

  walk(source)

  return locations
}

/**
 * Removes any candidate whose s3Key is still referenced by a construction
 * drawing on any marine licence. A rejected licence can be copied into a new
 * one, which duplicates the s3Location values, so the same object can be
 * shared by more than one document. Call this _after_ the mongo mutation: the
 * current document's own reference is gone by then, so no document needs
 * excluding.
 */
export const filterUnreferencedS3Keys = async (db, s3Locations) => {
  if (s3Locations.length === 0) {
    return []
  }

  const s3Keys = s3Locations.map(({ s3Key }) => s3Key)

  const referencingLicences = await db
    .collection(collectionMarineLicences)
    .find(
      { 'siteDetails.constructionDrawings.s3Location.s3Key': { $in: s3Keys } },
      { projection: { 'siteDetails.constructionDrawings.s3Location': 1 } }
    )
    .toArray()

  const referencedKeys = new Set(
    referencingLicences.flatMap((licence) =>
      collectS3Locations(licence).map(({ s3Key }) => s3Key)
    )
  )

  const [retained, unreferenced] = s3Locations.reduce(
    ([kept, removable], location) => {
      if (referencedKeys.has(location.s3Key)) {
        kept.push(location)
      } else {
        removable.push(location)
      }
      return [kept, removable]
    },
    [[], []]
  )

  if (retained.length > 0) {
    logger.info(
      { event: { action: 'delete', outcome: 'success' } },
      `${logSystem}: Retained ${retained.length} S3 object(s) still referenced by another marine licence: ${retained
        .map(({ s3Key }) => s3Key)
        .join(', ')}`
    )
  }

  return unreferenced
}

/**
 * Deletes objects from S3 without ever throwing. Mongo is the source of truth,
 * so a storage failure must not stop a user removing a file - the object is
 * left orphaned and the failure logged.
 */
export const deleteS3ObjectsBestEffort = async (s3Locations) => {
  if (s3Locations.length === 0) {
    return
  }

  try {
    await blobService.deleteFiles(s3Locations)
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      `${logSystem}: Failed to delete S3 object(s): ${s3Locations
        .map(({ s3Bucket, s3Key }) => `${s3Bucket}/${s3Key}`)
        .join(', ')}`
    )
  }
}

/**
 * Deletes any of the given locations that no marine licence references any
 * more. Best-effort throughout - safe to await in a controller's happy path.
 */
export const deleteOrphanedS3Objects = async (db, s3Locations) => {
  if (s3Locations.length === 0) {
    return
  }

  try {
    const unreferenced = await filterUnreferencedS3Keys(db, s3Locations)
    await deleteS3ObjectsBestEffort(unreferenced)
  } catch (error) {
    logger.error(
      structureErrorForECS(error),
      `${logSystem}: Failed to determine orphaned S3 objects`
    )
  }
}
