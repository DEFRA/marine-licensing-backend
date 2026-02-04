import { parseGeoAreas } from './geo-parse.js'
import { createLogger } from '../logging/logger.js'
import {
  collectionCoastalOperationsAreas,
  collectionExemptions
} from '../../constants/db-collections.js'

export const updateCoastalOperationsAreas = async (
  exemption,
  db,
  { updatedAt, updatedBy }
) => {
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
      ? await parseGeoAreas(exemption, db, collectionCoastalOperationsAreas, {
          displayName: 'Coastal Operations Areas'
        })
      : []

  await db.collection(collectionExemptions).updateOne(
    { _id: exemption._id },
    {
      $set: { coastalOperationsAreas: result, updatedAt, updatedBy }
    }
  )

  return result
}
