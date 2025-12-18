import Boom from '@hapi/boom'
import { parseGeoAreas } from './geo-parse.js'
import { coastalEnforcementAreas } from '../../constants/db-collections.js'

export const updateCoastalEnforcementAreas = async (
  exemption,
  db,
  { updatedAt, updatedBy }
) => {
  if (!exemption) {
    throw Boom.notFound('Exemption not found')
  }

  const result = await parseGeoAreas(exemption, db, coastalEnforcementAreas, {
    displayName: 'Coastal Enforcement Areas'
  })

  await db.collection('exemptions').updateOne(
    { _id: exemption._id },
    {
      $set: { coastalEnforcementAreas: result, updatedAt, updatedBy }
    }
  )

  return result
}
