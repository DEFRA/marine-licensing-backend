import { createGeoAreaPopulatorPlugin } from './populate-geo-areas.js'
import { coastalEnforcementAreas } from '../../common/constants/db-collections.js'

export const populateCoastalEnforcementAreasPlugin =
  createGeoAreaPopulatorPlugin({
    pluginName: 'populate-coastal-enforcement-areas',
    configKey: 'coastalEnforcementArea',
    collectionName: coastalEnforcementAreas,
    areaDisplayName: 'Coastal Enforcement Areas'
  })
