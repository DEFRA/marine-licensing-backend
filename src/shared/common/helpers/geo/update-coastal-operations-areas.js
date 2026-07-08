import Boom from '@hapi/boom'
import { parseGeoAreas } from './geo-parse.js'
import { createLogger } from '../logging/logger.js'
import { collectionCoastalOperationsAreas } from '../../constants/db-collections.js'

export const updateCoastalOperationsAreas = async (
  project,
  db,
  { updatedAt, updatedBy, collectionName }
) => {
  if (!collectionName) {
    throw Boom.badImplementation(
      'A collection name is required to update Coastal Operations Areas'
    )
  }

  const logger = createLogger()

  const coastalOperationsAreasCount = await db
    .collection(collectionCoastalOperationsAreas)
    .countDocuments()

  if (coastalOperationsAreasCount === 0) {
    logger.info(
      'No Coastal Operations Areas exist in the collection so data will not be parsed'
    )
  }

  const result =
    coastalOperationsAreasCount > 0
      ? await parseGeoAreas(project, db, collectionCoastalOperationsAreas, {
          displayName: 'Coastal Operations Areas'
        })
      : []

  await db.collection(collectionName).updateOne(
    { _id: project._id },
    {
      $set: { coastalOperationsAreas: result, updatedAt, updatedBy }
    }
  )

  return result
}
