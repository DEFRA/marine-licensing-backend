import { parseGeoAreas } from './geo-parse.js'
import { marinePlanAreas } from '../../constants/db-collections.js'

export const updateMarinePlanningAreas = async (
  exemption,
  db,
  { updatedAt, updatedBy }
) => {
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
