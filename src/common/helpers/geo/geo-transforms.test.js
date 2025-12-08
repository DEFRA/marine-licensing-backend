import { describe, it, expect } from 'vitest'
import { formatGeoForStorage } from './geo-transforms.js'
import { mockFeatureCollection } from './test-fixtures.js'

describe('geo-transforms', () => {
  describe('formatGeoForStorage', () => {
    it('should correctly format all data', () => {
      const formattedGeoData = formatGeoForStorage(mockFeatureCollection)

      expect(formattedGeoData.length).toBe(2)

      expect(formattedGeoData[0]).toEqual({
        name: mockFeatureCollection.features[0].properties.info,
        properties: mockFeatureCollection.features[0].properties,
        geometry: { coordinates: expect.any(Array), type: 'Polygon' },
        type: 'Feature'
      })

      expect(formattedGeoData[1]).toEqual({
        name: mockFeatureCollection.features[1].properties.info,
        properties: mockFeatureCollection.features[1].properties,
        geometry: { coordinates: expect.any(Array), type: 'Polygon' },
        type: 'Feature'
      })
    })
  })
})
