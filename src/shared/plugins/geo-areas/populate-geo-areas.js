import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import { config } from '../../../config.js'
import { formatGeoForStorage } from '../../common/helpers/geo/geo-transforms.js'

export const fetchAndValidateGeoData = async (geoJsonUrl, areaName) => {
  const { payload } = await Wreck.get(geoJsonUrl, { json: true })

  if (!payload?.features) {
    throw Boom.badImplementation(`Invalid GeoJSON response for ${areaName}`)
  }

  if (payload.features.length === 0) {
    throw Boom.badImplementation(`No features found in GeoJSON for ${areaName}`)
  }

  return payload
}

export const shouldRefreshCollection = async (collection, refreshFlag) => {
  if (refreshFlag) {
    return true
  }

  const count = await collection.countDocuments()
  return count === 0
}

export const createGeoAreaPopulatorPlugin = ({
  pluginName,
  configKey,
  collectionName,
  areaDisplayName
}) => ({
  plugin: {
    name: pluginName,
    register: async (server) => {
      const externalGeoAreas = config.get('externalGeoAreas')
      const areaConfig = externalGeoAreas[configKey]

      if (!areaConfig?.geoJsonUrl) {
        server.logger.error(`${areaDisplayName} API URL not configured`)
        return
      }

      try {
        const collection = server.db.collection(collectionName)
        const shouldRefresh = await shouldRefreshCollection(
          collection,
          areaConfig.refreshAreas
        )

        if (!shouldRefresh) {
          server.logger.info(
            `${areaDisplayName} collection already populated with documents`
          )
          return
        }

        server.logger.info(
          `${areaDisplayName} collection is empty, fetching data from API`
        )

        const { geoJsonUrl, refreshAreas } = areaConfig
        const payload = await fetchAndValidateGeoData(
          geoJsonUrl,
          areaDisplayName
        )

        if (refreshAreas) {
          server.logger.info(
            `${areaDisplayName} refresh areas is enabled, clearing existing data`
          )
          await collection.deleteMany({})
        }

        const features = formatGeoForStorage(payload)

        await collection.insertMany(features)

        server.logger.info(
          `Successfully populated ${areaDisplayName} collection with ${features.length} features`
        )
      } catch (error) {
        server.logger.error(
          {
            error: Boom.isBoom(error) ? error.output.payload : error.message
          },
          `Failed to populate ${areaDisplayName} collection`
        )
      }
    }
  }
})
