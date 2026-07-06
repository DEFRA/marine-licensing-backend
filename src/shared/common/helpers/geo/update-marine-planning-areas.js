import Boom from '@hapi/boom'
import { parseGeoAreas } from './geo-parse.js'
import { createLogger } from '../logging/logger.js'
import { collectionMarinePlanAreas } from '../../constants/db-collections.js'

export const updateMarinePlanningAreas = async (
  project,
  db,
  { updatedAt, updatedBy, collectionName }
) => {
  if (!collectionName) {
    throw Boom.badImplementation(
      'A collection name is required to update Marine Plan Areas'
    )
  }

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
      ? await parseGeoAreas(project, db, collectionMarinePlanAreas, {
          displayName: 'Marine Plan Areas'
        })
      : []

  await db.collection(collectionName).updateOne(
    { _id: project._id },
    {
      $set: { marinePlanAreas: result, updatedAt, updatedBy }
    }
  )

  return result
}
