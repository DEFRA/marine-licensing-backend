import { parseGeoAreas } from './geo-parse.js'
import { marinePlanAreas } from '../../constants/db-collections.js'
import { createLogger } from '../logging/logger.js'

export const updateMarinePlanningAreas = async (
  exemption,
  db,
  { updatedAt, updatedBy }
) => {
  const logger = createLogger()

  const marinePlanAreasCount = await db
    .collection(marinePlanAreas)
    .countDocuments()

  if (marinePlanAreasCount === 0) {
    logger.info(
      'No Marine Plan Areas exist in the collection so data will not be parsed'
    )
  }

  const result =
    marinePlanAreasCount > 0
      ? await parseGeoAreas(exemption, db, marinePlanAreas, {
          displayName: 'Marine Plan Areas'
        })
      : []

  await db.collection('exemptions').updateOne(
    { _id: exemption._id },
    {
      $set: { marinePlanAreas: result, updatedAt, updatedBy }
    }
  )

  return result
}
