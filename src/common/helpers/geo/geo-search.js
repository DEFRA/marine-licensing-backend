import Boom from '@hapi/boom'
import { addBufferToShape } from './geo-utils.js'

export const outputIntersectionAreas = async (
  db,
  siteGeometries,
  collectionName
) => {
  const result = []

  for (const geometry of siteGeometries) {
    try {
      const bufferedGeometry = addBufferToShape(geometry, 50)

      const intersectingAreas = await db
        .collection(collectionName)
        .find(
          {
            geometry: {
              $geoIntersects: {
                $geometry: bufferedGeometry
              }
            }
          },
          {
            projection: { name: 1, _id: 0 }
          }
        )
        .toArray()

      for (const area of intersectingAreas) {
        result.push(area.name)
      }
    } catch (error) {
      throw Boom.internal('Error searching coordinates')
    }
  }

  return [...new Set(result)]
}
