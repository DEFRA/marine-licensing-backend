import { describe, test, expect, vi, beforeEach } from 'vitest'
import proj4 from 'proj4'
import { buffer } from '@turf/turf'
import {
  singleOSGB36toWGS84,
  addBufferToShape,
  areCoordsTheSame
} from './geo-utils.js'
import { mockPointGeometry, mockPolygonGeometry } from './test.fixture.js'

vi.mock('proj4')
vi.mock('@turf/turf')

describe('geo-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('singleOSGB36toWGS84', () => {
    test('should convert OSGB36 coordinates to WGS84', () => {
      const mockLongitude = -1.5491
      const mockLatitude = 54.9783

      vi.mocked(proj4).mockReturnValue([mockLongitude, mockLatitude])

      const result = singleOSGB36toWGS84({
        eastings: '424199',
        northings: '564345'
      })

      expect(proj4).toHaveBeenCalledWith('OSGB36', 'WGS84', [424199, 564345])
      expect(result).toEqual([mockLongitude, mockLatitude])
    })
  })

  describe('addBufferToShape', () => {
    test('should add buffer to geometry successfully', () => {
      const mockBuffered = {
        geometry: mockPolygonGeometry
      }

      vi.mocked(buffer).mockReturnValue(mockBuffered)

      const result = addBufferToShape(mockPointGeometry, 50)

      expect(buffer).toHaveBeenCalledWith(mockPointGeometry, 50, {
        units: 'meters'
      })
      expect(result).toEqual(mockPolygonGeometry)
    })

    test('should throw error when buffer throws an error', () => {
      const mockError = new Error('Invalid geometry')

      vi.mocked(buffer).mockImplementation(() => {
        throw mockError
      })

      expect(() => addBufferToShape({}, 50)).toThrow(
        'Error adding buffer to shape: Invalid geometry'
      )

      expect(buffer).toHaveBeenCalledWith({}, 50, {
        units: 'meters'
      })
    })
  })

  describe('areCoordsTheSame', () => {
    test('should return true when coordinates are identical', () => {
      const coord1 = { latitude: '54.088594', longitude: '-0.178408' }
      const coord2 = { latitude: '54.088594', longitude: '-0.178408' }

      const result = areCoordsTheSame(coord1, coord2)

      expect(result).toBe(true)
    })

    test('should return true when coordinates are identical with different string formats', () => {
      const coord1 = { latitude: '54.088594', longitude: '-0.178408' }
      const coord2 = { latitude: '54.088594000', longitude: '-0.178408000' }

      const result = areCoordsTheSame(coord1, coord2)

      expect(result).toBe(true)
    })

    test('should return false when latitudes are different', () => {
      const coord1 = { latitude: '54.088594', longitude: '-0.178408' }
      const coord2 = { latitude: '54.088595', longitude: '-0.178408' }

      const result = areCoordsTheSame(coord1, coord2)

      expect(result).toBe(false)
    })

    test('should return false when longitudes are different', () => {
      const coord1 = { latitude: '54.088594', longitude: '-0.178408' }
      const coord2 = { latitude: '54.088594', longitude: '-0.178409' }

      const result = areCoordsTheSame(coord1, coord2)

      expect(result).toBe(false)
    })

    test('should handle numeric string coordinates', () => {
      const coord1 = { latitude: '51.5074', longitude: '-0.1278' }
      const coord2 = { latitude: '51.5074', longitude: '-0.1278' }

      const result = areCoordsTheSame(coord1, coord2)

      expect(result).toBe(true)
    })

    test('should detect very small differences in coordinates', () => {
      const coord1 = { latitude: '54.088594', longitude: '-0.178408' }
      const coord2 = { latitude: '54.088594001', longitude: '-0.178408' }

      const result = areCoordsTheSame(coord1, coord2)

      expect(result).toBe(false)
    })
  })
})
