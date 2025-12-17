import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import { config } from '../config.js'
import { formatGeoForStorage } from '../common/helpers/geo/geo-transforms.js'
import { coastalEnforcementAreas } from '../common/constants/db-collections.js'

export const populateCoastalEnforcementAreasPlugin = {
  plugin: {
    name: 'populate-coastal-enforcement-areas',
    register: async (server) => {
      const { coastalEnforcementArea } = config.get('externalGeoAreas')

      if (!coastalEnforcementArea?.geoJsonUrl) {
        server.logger.error('Coastal Enforcement Areas API URL not configured')
        return
      }

      try {
        const collection = server.db.collection(coastalEnforcementAreas)

        if (!coastalEnforcementArea.refreshCoastalEnforcementArea) {
          const count = await collection.countDocuments()

          if (count > 0) {
            server.logger.info(
              `Marine Plan Areas collection already populated with documents`
            )
            return
          }
        }

        server.logger.info(
          'Coastal Enforcement Areas collection is empty, fetching data from API'
        )

        const { geoJsonUrl } = coastalEnforcementArea

        const { payload } = await Wreck.get(geoJsonUrl, { json: true })

        if (!payload?.features) {
          throw Boom.badImplementation(
            'Invalid GeoJSON response for Coastal Enforcement Areas'
          )
        }

        if (coastalEnforcementArea.refreshCoastalEnforcementArea) {
          server.logger.info(
            'refreshCoastalEnforcementArea is enabled, clearing existing data'
          )
          await collection.deleteMany({})
        }

        const features = formatGeoForStorage(payload)

        await collection.insertMany(features)

        server.logger.info(
          `Successfully populated Coastal Enforcement Areas collection with ${features.length} features`
        )
      } catch (error) {
        server.logger.error(
          {
            error: Boom.isBoom(error) ? error.output.payload : error.message
          },
          'Failed to populate Coastal Enforcement Areas collection'
        )
      }
    }
  }
}
