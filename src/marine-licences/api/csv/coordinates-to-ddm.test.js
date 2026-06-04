import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertCoordinatesToDdm } from './coordinates-to-ddm.js'
import { coordinatesToDegreesDecimalMinutes } from '../../../shared/common/helpers/geo/geo-transforms.js'

vi.mock('../../../shared/common/helpers/geo/geo-transforms.js', () => ({
  coordinatesToDegreesDecimalMinutes: vi.fn()
}))

beforeEach(() => {
  vi.clearAllMocks()
  coordinatesToDegreesDecimalMinutes.mockImplementation((value, isLatitude) =>
    isLatitude ? `${value}° N` : `${value}° W`
  )
})

describe('convertCoordinatesToDdm', () => {
  describe('circle and polygon sites', () => {
    it('converts each point in the feature to a DDM { lat, lon } object', () => {
      const feature = [
        [-0.1, 51.5],
        [-0.2, 51.6],
        [-0.1, 51.5]
      ]

      const result = convertCoordinatesToDdm([feature])

      expect(result).toEqual([
        [
          { lat: '51.5° N', lon: '-0.1° W' },
          { lat: '51.6° N', lon: '-0.2° W' },
          { lat: '51.5° N', lon: '-0.1° W' }
        ]
      ])
    })

    it('calls coordinatesToDegreesDecimalMinutes with lat as isLatitude=true and lon as isLatitude=false', () => {
      const feature = [[-0.1, 51.5]]

      convertCoordinatesToDdm([feature])

      expect(coordinatesToDegreesDecimalMinutes).toHaveBeenCalledWith(
        51.5,
        true
      )
      expect(coordinatesToDegreesDecimalMinutes).toHaveBeenCalledWith(
        -0.1,
        false
      )
    })

    it('returns one entry per site', () => {
      const feature1 = [[-0.1, 51.5]]
      const feature2 = [[-1.0, 52.0]]

      const result = convertCoordinatesToDdm([feature1, feature2])

      expect(result).toHaveLength(2)
    })
  })

  describe('file upload sites', () => {
    it('flattens all feature features into a single array matching the manual site structure', () => {
      const feature1 = [
        [-1.0, 50.0],
        [-1.0, 51.0]
      ]
      const feature2 = [
        [-3.0, 52.0],
        [-4.0, 53.0]
      ]
      const fileUploadSite = [feature1, feature2]

      const result = convertCoordinatesToDdm([fileUploadSite])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual([
        { lat: '50° N', lon: '-1° W' },
        { lat: '51° N', lon: '-1° W' },
        { lat: '52° N', lon: '-3° W' },
        { lat: '53° N', lon: '-4° W' }
      ])
    })
  })

  describe('edge cases', () => {
    it('returns an empty array for empty input', () => {
      expect(convertCoordinatesToDdm([])).toEqual([])
    })

    it('propagates errors thrown by coordinatesToDegreesDecimalMinutes', () => {
      coordinatesToDegreesDecimalMinutes.mockImplementation(() => {
        throw new Error('Invalid coordinate value: 999')
      })

      expect(() => convertCoordinatesToDdm([[[-0.1, 999]]])).toThrow(
        'Invalid coordinate value: 999'
      )
    })
  })
})
