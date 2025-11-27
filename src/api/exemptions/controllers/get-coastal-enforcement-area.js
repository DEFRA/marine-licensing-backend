import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { getExemption } from '../../../models/get-exemption.js'
import { ObjectId } from 'mongodb'
import * as turf from '@turf/turf'
import { generateCirclePolygon } from '../../../common/helpers/emp/transforms/circle-to-polygon.js'

export const getCoastalEnforcementAreaController = {
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

      const marinePlanAreas = await db
        .collection('experiment-coastal-areas')
        .find({})
        .toArray()

      const result = exemption.siteDetails.map((site, siteIndex) => {
        const sitePolygons = []

        if (site.geoJSON?.features) {
          for (const feature of site.geoJSON.features) {
            if (feature.geometry?.coordinates) {
              try {
                sitePolygons.push(turf.polygon(feature.geometry.coordinates))
              } catch (error) {
                // Skip invalid polygons
                continue
              }
            }
          }
        } else if (site.coordinatesEntry === 'single') {
          try {
            const radiusMetres = parseInt(site.circleWidth, 10) / 2
            const circleCoords = generateCirclePolygon({
              latitude: parseFloat(site.coordinates.latitude),
              longitude: parseFloat(site.coordinates.longitude),
              radiusMetres
            })
            sitePolygons.push(turf.polygon([circleCoords]))
          } catch (error) {
            // Skip invalid circle
          }
        } else if (site.coordinatesEntry === 'multiple') {
          try {
            const coords = site.coordinates.map((c) => [
              parseFloat(c.longitude),
              parseFloat(c.latitude)
            ])
            const firstCoord = coords[0]
            const lastCoord = coords[coords.length - 1]
            if (
              firstCoord[0] !== lastCoord[0] ||
              firstCoord[1] !== lastCoord[1]
            ) {
              coords.push(firstCoord)
            }
            sitePolygons.push(turf.polygon([coords]))
          } catch (error) {
            // Skip invalid polygon
          }
        }

        if (sitePolygons.length === 0) {
          return { site: siteIndex, coastalArea: 'none' }
        }

        for (const sitePolygon of sitePolygons) {
          for (const area of marinePlanAreas) {
            if (!area.geometry || !area.geometry.coordinates) {
              continue
            }

            try {
              const areaPolygon =
                area.geometry.type === 'Polygon'
                  ? turf.polygon(area.geometry.coordinates)
                  : turf.multiPolygon(area.geometry.coordinates)

              if (turf.booleanIntersects(sitePolygon, areaPolygon)) {
                return { site: siteIndex, coastalArea: area.name }
              }
            } catch (error) {
              continue
            }
          }
        }

        return { site: siteIndex, coastalArea: 'none' }
      })

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
