import { parseGeoAreas } from './geo-parse.js'
import { createLogger } from '../logging/logger.js'
import {
  collectionExemptions,
  collectionMarinePlanAreas
} from '../../constants/db-collections.js'

export const updateMarinePlanningAreas = async (
  exemption,
  db,
  { updatedAt, updatedBy }
) => {
  const logger = createLogger()

  const marinePlanAreasCount = await db
    .collection(collectionMarinePlanAreas)
    .countDocuments()

  if (marinePlanAreasCount === 0) {
    logger.info(
      'No Marine Plan Areas exist in the collection so data will not be parsed'
    )
  }

  const result =
    marinePlanAreasCount > 0
      ? await parseGeoAreas(exemption, db, collectionMarinePlanAreas, {
          displayName: 'Marine Plan Areas'
        })
      : []

  await db.collection(collectionExemptions).updateOne(
    { _id: exemption._id },
    {
      $set: { marinePlanAreas: result, updatedAt, updatedBy }
    }
  )

  return result
}
