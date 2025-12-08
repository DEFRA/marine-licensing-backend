import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import { config } from '../config.js'
import { formatGeoForStorage } from '../common/helpers/geo/geo-transforms.js'

export const populateMarinePlanAreasPlugin = {
  plugin: {
    name: 'populate-marine-plan-areas',
    register: async (server) => {
      const { marinePlanArea } = config.get('externalGeoAreas')

      if (!marinePlanArea?.geoJsonUrl) {
        server.logger.warn('Marine Plan Areas API URL not configured')
        return
      }

      const { geoJsonUrl } = marinePlanArea

      try {
        const collection = server.db.collection('marine-plan-areas')
        const count = await collection.countDocuments()

        if (count > 0) {
          server.logger.info(
            `Marine Plan Areas collection already populated with documents`
          )
          return
        }

        server.logger.info(
          'Marine Plan Areas collection is empty, fetching data from API'
        )

        const { payload } = await Wreck.get(geoJsonUrl, { json: true })

        if (!payload?.features) {
          throw Boom.badImplementation('Invalid GeoJSON response')
        }

        const features = formatGeoForStorage(payload)

        await collection.insertMany(features)

        server.logger.info(
          `Successfully populated Marine Plan Areas collection with ${features.length} features`
        )
      } catch (error) {
        server.logger.error(
          {
            error: Boom.isBoom(error) ? error.output.payload : error.message
          },
          'Failed to populate Marine Plan Areas collection'
        )
      }
    }
  }
}
