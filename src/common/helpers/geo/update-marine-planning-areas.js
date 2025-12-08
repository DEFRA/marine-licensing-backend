import Boom from '@hapi/boom'
import { parseGeoAreas } from './geo-parse.js'
import { marinePlanAreas } from '../../constants/db-collections.js'

export const updateMarinePlanningAreas = async (
  exemption,
  db,
  { updatedAt, updatedBy }
) => {
  if (!exemption) {
    throw Boom.notFound('Exemption not found')
  }

  const data = await parseGeoAreas(exemption, db, marinePlanAreas)

  await db.collection('exemptions').updateOne(
    { _id: exemption._id },
    {
      $set: { marinePlanAreas: data, updatedAt, updatedBy }
    }
  )
}
