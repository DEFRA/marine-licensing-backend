import { createGeoAreaPopulatorPlugin } from './populate-geo-areas.js'
import { collectionCoastalEnforcementAreas } from '../../common/constants/db-collections.js'

export const populateCoastalEnforcementAreasPlugin =
  createGeoAreaPopulatorPlugin({
    pluginName: 'populate-coastal-enforcement-areas',
    configKey: 'coastalEnforcementArea',
    collectionName: collectionCoastalEnforcementAreas,
    areaDisplayName: 'Coastal Enforcement Areas'
  })
