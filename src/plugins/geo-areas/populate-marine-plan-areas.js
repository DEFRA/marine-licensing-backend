import { createGeoAreaPopulatorPlugin } from './populate-geo-areas.js'
import { marinePlanAreas } from '../../common/constants/db-collections.js'

export const populateMarinePlanAreasPlugin = createGeoAreaPopulatorPlugin({
  pluginName: 'populate-marine-plan-areas',
  configKey: 'marinePlanArea',
  collectionName: marinePlanAreas,
  areaDisplayName: 'Marine Plan Areas'
})
