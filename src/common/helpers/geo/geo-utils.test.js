import { describe, test, expect, vi, beforeEach } from 'vitest'
import proj4 from 'proj4'
import { buffer } from '@turf/turf'
import { singleOSGB36toWGS84, addBufferToShape } from './geo-utils.js'

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
      const mockGeometry = {
        type: 'Point',
        coordinates: [-1.5491, 54.9783]
      }

      const mockBufferedGeometry = {
        type: 'Polygon',
        coordinates: [
          [
            [-1.5492, 54.9783],
            [-1.5491, 54.9784],
            [-1.549, 54.9783],
            [-1.5491, 54.9782],
            [-1.5492, 54.9783]
          ]
        ]
      }

      const mockBuffered = {
        geometry: mockBufferedGeometry
      }

      vi.mocked(buffer).mockReturnValue(mockBuffered)

      const result = addBufferToShape(mockGeometry, 50)

      expect(buffer).toHaveBeenCalledWith(mockGeometry, 50, {
        units: 'meters'
      })
      expect(result).toEqual(mockBufferedGeometry)
    })

    test('should return error when buffer throws an error', () => {
      const mockError = new Error('Invalid geometry')

      vi.mocked(buffer).mockImplementation(() => {
        throw mockError
      })

      const result = addBufferToShape({}, 50)

      expect(buffer).toHaveBeenCalledWith({}, 50, {
        units: 'meters'
      })
      expect(result).toEqual(mockError)
    })
  })
})
