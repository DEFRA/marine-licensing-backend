import { describe, it, expect } from 'vitest'
import { coordinatesToCsvObject } from './coordinates-to-csv.js'

describe('coordinatesToCsvObject', () => {
  describe('valid sites', () => {
    it('converts a single point to a CSV row object', () => {
      const result = coordinatesToCsvObject([
        [{ lat: "51° 30.0' N", lon: "0° 7.5' W" }]
      ])

      expect(result).toEqual([
        [{ latDegree: 51, latDecMin: 30.0, longDegree: 0, longDecMin: 7.5 }]
      ])
    })

    it('converts multiple points in a site', () => {
      const site = [
        { lat: "51° 30.0' N", lon: "0° 7.5' W" },
        { lat: "52° 15.5' N", lon: "1° 20.0' E" }
      ]

      const result = coordinatesToCsvObject([site])

      expect(result).toEqual([
        [
          { latDegree: 51, latDecMin: 30.0, longDegree: 0, longDecMin: 7.5 },
          { latDegree: 52, latDecMin: 15.5, longDegree: 1, longDecMin: 20.0 }
        ]
      ])
    })
  })

  describe('edge cases', () => {
    it('returns an empty array for empty input', () => {
      expect(coordinatesToCsvObject([])).toEqual([])
    })

    it('returns an empty array for a site with no points', () => {
      expect(coordinatesToCsvObject([[]])).toEqual([[]])
    })
  })
})
