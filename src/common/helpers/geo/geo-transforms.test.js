import { describe, it, expect } from 'vitest'
import { formatGeoForStorage } from './geo-transforms.js'
import { mockFeatureCollection } from './test.fixture.js'

describe('geo-transforms', () => {
  describe('formatGeoForStorage', () => {
    it('should correctly format all data for Marine Plan Areas', () => {
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

    it('should correctly format all data for Coastal Operations Areas', () => {
      const mockCoastalAreasCollection = {
        ...mockFeatureCollection,
        features: mockFeatureCollection.features.map((area) => {
          const coastalArea = {
            ...area,
            properties: { marine_are: area.properties.info }
          }
          return coastalArea
        })
      }

      const formattedGeoData = formatGeoForStorage(mockCoastalAreasCollection)

      expect(formattedGeoData.length).toBe(2)

      expect(formattedGeoData[0]).toEqual({
        name: mockCoastalAreasCollection.features[0].properties.marine_are,
        properties: mockCoastalAreasCollection.features[0].properties,
        geometry: { coordinates: expect.any(Array), type: 'Polygon' },
        type: 'Feature'
      })
    })
  })
})
