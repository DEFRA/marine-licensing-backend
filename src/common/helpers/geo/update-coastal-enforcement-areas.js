import { parseGeoAreas } from './geo-parse.js'
import {
  collectionCoastalEnforcementAreas,
  collectionExemptions
} from '../../constants/db-collections.js'

export const updateCoastalEnforcementAreas = async (
  exemption,
  db,
  { updatedAt, updatedBy }
) => {
  const result = await parseGeoAreas(
    exemption,
    db,
    collectionCoastalEnforcementAreas,
    {
      displayName: 'Coastal Enforcement Areas'
    }
  )

  await db.collection(collectionExemptions).updateOne(
    { _id: exemption._id },
    {
      $set: { coastalEnforcementAreas: result, updatedAt, updatedBy }
    }
  )

  return result
}
