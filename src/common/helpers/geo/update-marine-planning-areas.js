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

  const result = await parseGeoAreas(exemption, db, marinePlanAreas, {
    displayName: 'Marine Plan Areas'
  })

  await db.collection('exemptions').updateOne(
    { _id: exemption._id },
    {
      $set: { marinePlanAreas: result, updatedAt, updatedBy }
    }
  )

  return result
}
