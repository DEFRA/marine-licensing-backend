import { parseGeoAreas } from './geo-parse.js'
import { createLogger } from '../logging/logger.js'
import {
  collectionCoastalEnforcementAreas,
  collectionExemptions
} from '../../constants/db-collections.js'

export const updateCoastalEnforcementAreas = async (
  exemption,
  db,
  { updatedAt, updatedBy }
) => {
  const logger = createLogger()

  const coastalEnforcementAreasCount = await db
    .collection(collectionCoastalEnforcementAreas)
    .countDocuments()

  if (coastalEnforcementAreasCount === 0) {
    logger.info(
      'No Coastal Enforcement Areas exist in the collection so data will not be parsed'
    )
  }

  const result =
    coastalEnforcementAreasCount > 0
      ? await parseGeoAreas(exemption, db, collectionCoastalEnforcementAreas, {
          displayName: 'Coastal Enforcement Areas'
        })
      : []

  await db.collection(collectionExemptions).updateOne(
    { _id: exemption._id },
    {
      $set: { coastalEnforcementAreas: result, updatedAt, updatedBy }
    }
  )

  return result
}
