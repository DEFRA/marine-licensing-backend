import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import * as turf from '@turf/turf'
import joi from 'joi'

const querySchema = joi.object({
  collection: joi
    .string()
    .valid('experiment-coastal-areas', 'experiment-coastal-plan-areas')
    .default('experiment-coastal-areas')
})

export const getCoastalEnforcementAreaController = {
  options: {
    validate: {
      params: getExemption,
      query: querySchema
    }
  },
  handler: async (request, h) => {
    const startTime = performance.now()
    const startMemory = process.memoryUsage()

    try {
      const { params, db, query } = request
      const collectionName = query.collection || 'experiment-coastal-areas'

      const exemption = await db
        .collection('exemptions')
        .findOne({ _id: ObjectId.createFromHexString(params.id) })

      if (!exemption) {
        throw Boom.notFound('Exemption not found')
      }

      if (!exemption.siteDetails) {
        return h
          .response({
            message: 'success',
            value: {
              result: []
            }
          })
          .code(StatusCodes.OK)
      }

      const marinePlanAreas = await db
        .collection(collectionName)
        .find({})
        .toArray()

      const result = exemption.siteDetails.map((site, siteIndex) => {
        if (!site.geoJSON?.features) {
          return { site: siteIndex, coastalArea: 'none' }
        }

        for (const feature of site.geoJSON.features) {
          if (!feature.geometry?.coordinates) {
            continue
          }

          for (const area of marinePlanAreas) {
            if (!area.geometry || !area.geometry.coordinates) {
              continue
            }

            try {
              const sitePolygon = turf.polygon(feature.geometry.coordinates)
              // Apply 50m buffer
              const bufferedSitePolygon = turf.buffer(sitePolygon, 50, {
                units: 'meters'
              })
              const areaPolygon =
                area.geometry.type === 'Polygon'
                  ? turf.polygon(area.geometry.coordinates)
                  : turf.multiPolygon(area.geometry.coordinates)

              if (turf.booleanIntersects(bufferedSitePolygon, areaPolygon)) {
                return { site: siteIndex, coastalArea: area.name }
              }
            } catch (error) {
              continue
            }
          }
        }

        return { site: siteIndex, coastalArea: 'none' }
      })

      const endTime = performance.now()
      const endMemory = process.memoryUsage()

      return h
        .response({
          message: 'success',
          value: {
            result,
            performance: {
              // Duration in milliseconds - how long the query took from start to finish
              // Lower is better. Compare with MongoDB endpoint to see which is faster
              durationMs: (endTime - startTime).toFixed(2),
              memoryDeltaMB: {
                // JavaScript heap memory used by your code during the query
                // Higher values indicate more data loaded into memory (e.g., all marine areas)
                heapUsed: (
                  (endMemory.heapUsed - startMemory.heapUsed) /
                  1024 /
                  1024
                ).toFixed(2),
                // Memory used by C++ objects bound to JavaScript (native libraries like MongoDB driver)
                // Usually smaller, but can grow with large native operations
                external: (
                  (endMemory.external - startMemory.external) /
                  1024 /
                  1024
                ).toFixed(2),
                // Resident Set Size - total memory allocated to the Node.js process (heap + external + code)
                // The big picture - overall memory footprint of the request. Lower is better
                rss: ((endMemory.rss - startMemory.rss) / 1024 / 1024).toFixed(
                  2
                )
              }
            }
          }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error retrieving exemption: ${error.message}`)
    }
  }
}
