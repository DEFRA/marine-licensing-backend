import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import {
  convertPolyCoords,
  convertSingleCoords,
  outputIntersectionAreas
} from '../../../common/costal-utils.js'

export const getCoastalEnforcementAreaMongoController = {
  options: {
    validate: {
      params: getExemption
    }
  },
  handler: async (request, h) => {
    try {
      const { params, db } = request

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
            value: { result: [] }
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
            await outputIntersectionAreas(db, siteGeometries, siteIndex)
          )
        }
      }

      return h
        .response({
          message: 'success',
          value: { result }
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
