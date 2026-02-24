import { describe, test, expect, vi } from 'vitest'
import { collectionCoastalOperationsAreas } from '../../common/constants/db-collections.js'
const { createGeoAreaPopulatorPlugin } = await import('./populate-geo-areas.js')

vi.mock('./populate-geo-areas.js', () => ({
  createGeoAreaPopulatorPlugin: vi.fn(() => ({
    plugin: {
      name: 'test-plugin',
      register: vi.fn()
    }
  }))
}))

describe('populateCoastalOperationsAreasPlugin', () => {
  test('creates plugin with correct parameters', async () => {
    await import('./populate-coastal-operations-areas.js')

    expect(createGeoAreaPopulatorPlugin).toHaveBeenCalledWith({
      pluginName: 'populate-coastal-operations-areas',
      configKey: 'coastalOperationsAreas',
      collectionName: collectionCoastalOperationsAreas,
      areaDisplayName: 'Coastal Operations Areas'
    })
  })
})
