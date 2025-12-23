import { describe, test, expect, vi } from 'vitest'
import { marinePlanAreas } from '../../common/constants/db-collections.js'
const { createGeoAreaPopulatorPlugin } = await import('./populate-geo-areas.js')

vi.mock('./populate-geo-areas.js', () => ({
  createGeoAreaPopulatorPlugin: vi.fn(() => ({
    plugin: {
      name: 'test-plugin',
      register: vi.fn()
    }
  }))
}))

describe('populateMarinePlanAreasPlugin', () => {
  test('creates plugin with correct parameters', async () => {
    await import('./populate-marine-plan-areas.js')

    expect(createGeoAreaPopulatorPlugin).toHaveBeenCalledWith({
      pluginName: 'populate-marine-plan-areas',
      configKey: 'marinePlanArea',
      collectionName: marinePlanAreas,
      areaDisplayName: 'Marine Plan Areas'
    })
  })
})
