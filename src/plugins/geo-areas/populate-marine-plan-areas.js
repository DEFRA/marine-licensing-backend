import { createGeoAreaPopulatorPlugin } from './populate-geo-areas.js'
import { collectionMarinePlanAreas } from '../../common/constants/db-collections.js'

export const populateMarinePlanAreasPlugin = createGeoAreaPopulatorPlugin({
  pluginName: 'populate-marine-plan-areas',
  configKey: 'marinePlanArea',
  collectionName: collectionMarinePlanAreas,
  areaDisplayName: 'Marine Plan Areas'
})
