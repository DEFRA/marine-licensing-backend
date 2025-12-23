import { describe, test, expect, vi } from 'vitest'
import { coastalEnforcementAreas } from '../../common/constants/db-collections.js'
const { createGeoAreaPopulatorPlugin } = await import('./populate-geo-areas.js')

vi.mock('./populate-geo-areas.js', () => ({
  createGeoAreaPopulatorPlugin: vi.fn(() => ({
    plugin: {
      name: 'test-plugin',
      register: vi.fn()
    }
  }))
}))

describe('populateCoastalEnforcementAreasPlugin', () => {
  test('creates plugin with correct parameters', async () => {
    await import('./populate-coastal-enforcement-areas.js')

    expect(createGeoAreaPopulatorPlugin).toHaveBeenCalledWith({
      pluginName: 'populate-coastal-enforcement-areas',
      configKey: 'coastalEnforcementArea',
      collectionName: coastalEnforcementAreas,
      areaDisplayName: 'Coastal Enforcement Areas'
    })
  })
})
