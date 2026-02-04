import { createGeoAreaPopulatorPlugin } from './populate-geo-areas.js'
import { collectionCoastalOperationsAreas } from '../../common/constants/db-collections.js'

export const populateCoastalOperationsAreasPlugin =
  createGeoAreaPopulatorPlugin({
    pluginName: 'populate-coastal-operations-areas',
    configKey: 'coastalOperationsAreas',
    collectionName: collectionCoastalOperationsAreas,
    areaDisplayName: 'Coastal Operations Areas'
  })
