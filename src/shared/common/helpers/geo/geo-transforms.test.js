import { describe, expect } from 'vitest'
import {
  coordinatesToDegreesDecimalMinutes,
  formatGeoForStorage
} from './geo-transforms.js'
import { mockFeatureCollection } from './test.fixture.js'

describe('geo-transforms', () => {
  describe('formatGeoForStorage', () => {
    test('should correctly format all data for Marine Plan Areas', () => {
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

    test('should correctly format all data for Coastal Operations Areas', () => {
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
  describe('coordinatesToDegreesDecimalMinutes', () => {
    test.each([
      [53.386185, true, `53° 23.1711' N`],
      [-3.007353, false, `03° 00.4412' W`],
      [53.4808, true, `53° 28.8480' N`],
      [-2.2426005, false, `02° 14.5560' W`],
      [55.9533, true, `55° 57.1980' N`],
      [-3.188355, false, `03° 11.3013' W`],
      [51.4816, true, `51° 28.8960' N`],
      [-3.179151, false, `03° 10.7491' W`],
      [-33.8688, true, `33° 52.1280' S`],
      [1.2974, false, `01° 17.8440' E`]
    ])(
      'should correctly convert %s to Degrees Decimal Minutes format',
      (coordinateInput, isLatitude, expectedResult) => {
        const result = coordinatesToDegreesDecimalMinutes(
          coordinateInput,
          isLatitude
        )
        expect(result).toEqual(expectedResult)
      }
    )

    test('correctly errors on invalid coordinate values', () => {
      const invalidNumber = 'abc'
      expect(() =>
        coordinatesToDegreesDecimalMinutes(invalidNumber, false)
      ).toThrow('Invalid coordinate value: abc')
    })

    test('correctly errors on lng coordinate values below minimum', () => {
      expect(() => coordinatesToDegreesDecimalMinutes(-190, false)).toThrow(
        'Longitude out of range: -190'
      )
    })

    test('correctly errors on lng coordinate values above maximum', () => {
      expect(() => coordinatesToDegreesDecimalMinutes(190, false)).toThrow(
        'Longitude out of range: 190'
      )
    })

    test('correctly errors on lat coordinate values below minimum', () => {
      expect(() => coordinatesToDegreesDecimalMinutes(-190, true)).toThrow(
        'Latitude out of range: -190'
      )
    })

    test('correctly errors on lat coordinate values above maximum', () => {
      expect(() => coordinatesToDegreesDecimalMinutes(190, true)).toThrow(
        'Latitude out of range: 190'
      )
    })
  })
})
