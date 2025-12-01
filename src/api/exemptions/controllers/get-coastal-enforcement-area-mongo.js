import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import {
  convertPolyCoords,
  convertSingleCoords,
  outputIntersectionAreas
} from '../../../common/costal-utils.js'
import joi from 'joi'

const querySchema = joi.object({
  collection: joi
    .string()
    .valid('experiment-coastal-areas', 'experiment-coastal-plan-areas')
    .default('experiment-coastal-areas')
})

export const getCoastalEnforcementAreaMongoController = {
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

      const result = []

      for (
        let siteIndex = 0;
        siteIndex < exemption.siteDetails.length;
        siteIndex++
      ) {
        const site = exemption.siteDetails[siteIndex]

        const siteGeometries = []

        // Handle geoJSON uploads
        if (site.geoJSON?.features) {
          for (const feature of site.geoJSON.features) {
            if (feature.geometry?.coordinates) {
              try {
                siteGeometries.push({
                  type: feature.geometry.type,
                  coordinates: feature.geometry.coordinates
                })
              } catch (error) {
                // Skip invalid geometries
                continue
              }
            }
          }
        }
        // Handle single coordinate with circle width
        else if (site.coordinatesEntry === 'single') {
          try {
            siteGeometries.push(...convertSingleCoords(site))
          } catch (error) {}
        }
        // Handle multiple manual coordinates
        else if (site.coordinatesEntry === 'multiple') {
          try {
            siteGeometries.push(...convertPolyCoords(site))
          } catch (error) {}
        }

        if (siteGeometries.length > 0) {
          result.push(
            await outputIntersectionAreas(
              db,
              siteGeometries,
              siteIndex,
              collectionName
            )
          )
        }
      }

      const endTime = performance.now()
      const endMemory = process.memoryUsage()

      return h
        .response({
          message: 'success',
          value: {
            result,
            performance: {
              // Duration in milliseconds - how long the query took from start to finish
              // Lower is better. Compare with Turf.js endpoint to see which is faster
              durationMs: (endTime - startTime).toFixed(2),
              memoryDeltaMB: {
                // JavaScript heap memory used by your code during the query
                // Should be lower than Turf.js endpoint since MongoDB does the filtering
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
