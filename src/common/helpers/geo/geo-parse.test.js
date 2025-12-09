import { describe, test, expect, vi, beforeEach } from 'vitest'
import Boom from '@hapi/boom'
import {
  convertSingleCoordinates,
  convertMultipleCoordinates,
  parseGeoAreas
} from './geo-parse.js'
import { singleOSGB36toWGS84 } from './geo-utils.js'
import { generateCirclePolygon } from '../emp/transforms/circle-to-polygon.js'
import { outputIntersectionAreas } from './geo-search.js'
import {
  mockSiteWGS84,
  mockSiteOSGB36,
  mockSiteMultipleWGS84,
  mockSiteMultipleOSGB36,
  mockSiteFile,
  mockMarinePlanAreas
} from './test-fixtures.js'

vi.mock('./geo-utils.js')
vi.mock('../emp/transforms/circle-to-polygon.js')
vi.mock('./geo-search.js')

describe('geo-parse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('convertSingleCoordinates', () => {
    test('should convert WGS84 coordinates without OSGB36 conversion', () => {
      const mockCircleCoords = [
        [-0.23153, 51.489676],
        [-0.23152, 51.489686],
        [-0.23153, 51.489696],
        [-0.23154, 51.489686],
        [-0.23153, 51.489676]
      ]

      vi.mocked(generateCirclePolygon).mockReturnValue(mockCircleCoords)

      const result = convertSingleCoordinates(mockSiteWGS84)

      expect(singleOSGB36toWGS84).not.toHaveBeenCalled()
      expect(generateCirclePolygon).toHaveBeenCalledWith({
        latitude: 51.489676,
        longitude: -0.23153,
        radiusMetres: 10
      })
      expect(result).toEqual({
        type: 'Polygon',
        coordinates: [mockCircleCoords]
      })
    })

    test('should convert OSGB36 coordinates with OSGB36 to WGS84 conversion', () => {
      const mockConvertedLongitude = -0.178408
      const mockConvertedLatitude = 54.088594

      const mockCircleCoords = [
        [mockConvertedLongitude, mockConvertedLatitude],
        [mockConvertedLongitude + 0.0001, mockConvertedLatitude],
        [mockConvertedLongitude, mockConvertedLatitude + 0.0001],
        [mockConvertedLongitude - 0.0001, mockConvertedLatitude],
        [mockConvertedLongitude, mockConvertedLatitude]
      ]

      vi.mocked(singleOSGB36toWGS84).mockReturnValue([
        mockConvertedLongitude,
        mockConvertedLatitude
      ])
      vi.mocked(generateCirclePolygon).mockReturnValue(mockCircleCoords)

      const result = convertSingleCoordinates(mockSiteOSGB36)

      expect(singleOSGB36toWGS84).toHaveBeenCalledWith('513967', '476895')
      expect(generateCirclePolygon).toHaveBeenCalledWith({
        latitude: mockConvertedLatitude,
        longitude: mockConvertedLongitude,
        radiusMetres: 10
      })
      expect(result).toEqual({
        type: 'Polygon',
        coordinates: [mockCircleCoords]
      })
    })
  })

  describe('convertMultipleCoordinates', () => {
    test('should convert WGS84 multiple coordinates without OSGB36 conversion', () => {
      const result = convertMultipleCoordinates(mockSiteMultipleWGS84)

      expect(singleOSGB36toWGS84).not.toHaveBeenCalled()
      expect(result).toEqual([
        {
          type: 'Polygon',
          coordinates: [
            [
              [-0.178408, 54.088594],
              [-0.177369, 54.086782],
              [-0.175219, 54.088057]
            ]
          ]
        }
      ])
    })

    test('should convert OSGB36 multiple coordinates with OSGB36 to WGS84 conversion', () => {
      const mockConvertedCoords = [
        [-0.178408, 54.088594],
        [-0.177369, 54.086782],
        [-0.175219, 54.088057]
      ]

      vi.mocked(singleOSGB36toWGS84)
        .mockReturnValueOnce(mockConvertedCoords[0])
        .mockReturnValueOnce(mockConvertedCoords[1])
        .mockReturnValueOnce(mockConvertedCoords[2])

      const result = convertMultipleCoordinates(mockSiteMultipleOSGB36)

      expect(singleOSGB36toWGS84).toHaveBeenCalledTimes(3)
      expect(singleOSGB36toWGS84).toHaveBeenCalledWith('513967', '476895')
      expect(singleOSGB36toWGS84).toHaveBeenCalledWith('514040', '476693')
      expect(singleOSGB36toWGS84).toHaveBeenCalledWith('514193', '476835')
      expect(result).toEqual([
        {
          type: 'Polygon',
          coordinates: [mockConvertedCoords]
        }
      ])
    })
  })

  describe('parseGeoAreas', () => {
    let mockDb

    beforeEach(() => {
      mockDb = { collection: vi.fn() }
    })

    test('should throw error when exemption has no siteDetails', async () => {
      const exemption = { id: '123' }

      await expect(
        parseGeoAreas(exemption, mockDb, 'marine-plan-areas')
      ).rejects.toThrow(Boom.notFound('Exemption with site details not found'))
    })

    test('should process single coordinate sites and return marine plan areas', async () => {
      const exemption = {
        siteDetails: [mockSiteWGS84]
      }

      const mockCircleCoords = [[-0.23153, 51.489676]]

      vi.mocked(generateCirclePolygon).mockReturnValue(mockCircleCoords)
      vi.mocked(outputIntersectionAreas).mockResolvedValue(mockMarinePlanAreas)

      const result = await parseGeoAreas(exemption, mockDb, 'marine-plan-areas')

      expect(outputIntersectionAreas).toHaveBeenCalledWith(
        mockDb,
        [
          {
            type: 'Polygon',
            coordinates: [mockCircleCoords]
          }
        ],
        'marine-plan-areas'
      )
      expect(result).toEqual(mockMarinePlanAreas)
    })

    test('should process multiple coordinate sites and return marine plan areas', async () => {
      const exemption = {
        siteDetails: [mockSiteMultipleWGS84]
      }

      vi.mocked(outputIntersectionAreas).mockResolvedValue(mockMarinePlanAreas)

      const result = await parseGeoAreas(exemption, mockDb, 'marine-plan-areas')

      expect(outputIntersectionAreas).toHaveBeenCalledWith(
        mockDb,
        [
          {
            type: 'Polygon',
            coordinates: [
              [
                [-0.178408, 54.088594],
                [-0.177369, 54.086782],
                [-0.175219, 54.088057]
              ]
            ]
          }
        ],
        'marine-plan-areas'
      )
      expect(result).toEqual(mockMarinePlanAreas)
    })

    test('should process file coordinate sites and return marine plan areas', async () => {
      const exemption = {
        siteDetails: [mockSiteFile]
      }

      vi.mocked(outputIntersectionAreas).mockResolvedValue(mockMarinePlanAreas)

      const result = await parseGeoAreas(exemption, mockDb, 'marine-plan-areas')

      expect(outputIntersectionAreas).toHaveBeenCalledWith(
        mockDb,
        [[]],
        'marine-plan-areas'
      )
      expect(result).toEqual(mockMarinePlanAreas)
    })
  })
})
