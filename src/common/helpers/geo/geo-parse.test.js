import { describe, test, expect, vi, beforeEach } from 'vitest'
import Boom from '@hapi/boom'
import {
  convertSingleCoordinates,
  convertMultipleCoordinates,
  formatFileCoordinates,
  parseGeoAreas
} from './geo-parse.js'
import { singleOSGB36toWGS84 } from './geo-utils.js'
import { generateCirclePolygon } from '../emp/transforms/circle-to-polygon.js'
import { outputIntersectionAreas } from './geo-search.js'
import { createLogger } from '../logging/logger.js'
import {
  mockSiteWGS84,
  mockSiteOSGB36,
  mockSiteMultipleWGS84,
  mockSiteMultipleOSGB36,
  mockSiteFile,
  mockMarinePlanAreas
} from './test.fixture.js'
import { collectionMarinePlanAreas } from '../../constants/db-collections.js'

vi.mock('./geo-utils.js', async () => {
  const actual = await vi.importActual('./geo-utils.js')
  return {
    ...actual,
    singleOSGB36toWGS84: vi.fn()
  }
})
vi.mock('../emp/transforms/circle-to-polygon.js')
vi.mock('./geo-search.js')
vi.mock('../logging/logger.js')

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

      expect(singleOSGB36toWGS84).toHaveBeenCalledWith({
        eastings: '513967',
        northings: '476895'
      })
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
              [-0.175219, 54.088057],
              [-0.178408, 54.088594]
            ]
          ]
        }
      ])
    })

    test('should convert OSGB36 multiple coordinates with OSGB36 to WGS84 conversion', () => {
      const mockConvertedCoords = [
        [-0.178408, 54.088594],
        [-0.177369, 54.086782],
        [-0.175219, 54.088057],
        [-0.178408, 54.088594]
      ]

      vi.mocked(singleOSGB36toWGS84)
        .mockReturnValueOnce(mockConvertedCoords[0])
        .mockReturnValueOnce(mockConvertedCoords[1])
        .mockReturnValueOnce(mockConvertedCoords[2])
        .mockReturnValueOnce(mockConvertedCoords[0])

      const result = convertMultipleCoordinates(mockSiteMultipleOSGB36)

      expect(singleOSGB36toWGS84).toHaveBeenCalledTimes(4)
      expect(singleOSGB36toWGS84).toHaveBeenCalledWith({
        eastings: '513967',
        northings: '476895'
      })
      expect(singleOSGB36toWGS84).toHaveBeenCalledWith({
        eastings: '513967',
        northings: '476895'
      })
      expect(singleOSGB36toWGS84).toHaveBeenCalledWith({
        eastings: '513967',
        northings: '476895'
      })
      expect(result).toEqual([
        {
          type: 'Polygon',
          coordinates: [mockConvertedCoords]
        }
      ])
    })

    test('should not add closing coordinate when shape is already closed', () => {
      const closedCoordinates = [
        {
          latitude: '54.088594',
          longitude: '-0.178408'
        },
        {
          latitude: '54.086782',
          longitude: '-0.177369'
        },
        {
          latitude: '54.088057',
          longitude: '-0.175219'
        },
        {
          latitude: '54.088594',
          longitude: '-0.178408'
        }
      ]

      const result = convertMultipleCoordinates({
        ...mockSiteMultipleWGS84,
        coordinates: closedCoordinates
      })

      expect(result).toEqual([
        {
          type: 'Polygon',
          coordinates: [
            [
              [-0.178408, 54.088594],
              [-0.177369, 54.086782],
              [-0.175219, 54.088057],
              [-0.178408, 54.088594]
            ]
          ]
        }
      ])

      expect(result[0].coordinates[0]).toHaveLength(4)
    })
  })

  describe('formatFileCoordinates', () => {
    test('should return empty array when site has no geoJSON', () => {
      const site = { coordinatesType: 'file' }

      const result = formatFileCoordinates(site)

      expect(result).toEqual([])
    })

    test('should return empty array when geoJSON has no features', () => {
      const site = {
        coordinatesType: 'file',
        geoJSON: { type: 'FeatureCollection' }
      }

      const result = formatFileCoordinates(site)

      expect(result).toEqual([])
    })

    test('should return geometry for single valid feature', () => {
      const result = formatFileCoordinates(mockSiteFile)

      expect(result).toEqual([
        {
          type: 'Polygon',
          coordinates: [
            [
              [-2.6561784467249394, 55.6217431238072],
              [-2.3132402554949936, 55.32224616938891],
              [-2.9479108792966926, 55.331328251526465],
              [-2.6561784467249394, 55.6217431238072]
            ]
          ]
        }
      ])
    })

    test('should return multiple geometries for multiple valid features', () => {
      const site = {
        coordinatesType: 'file',
        geoJSON: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [-1.5491, 54.9783]
              }
            },
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-2.6561784467249394, 55.6217431238072],
                    [-2.3132402554949936, 55.32224616938891],
                    [-2.9479108792966926, 55.331328251526465],
                    [-2.6561784467249394, 55.6217431238072]
                  ]
                ]
              }
            }
          ]
        }
      }

      const result = formatFileCoordinates(site)

      expect(result).toEqual([
        {
          type: 'Point',
          coordinates: [-1.5491, 54.9783]
        },
        {
          type: 'Polygon',
          coordinates: [
            [
              [-2.6561784467249394, 55.6217431238072],
              [-2.3132402554949936, 55.32224616938891],
              [-2.9479108792966926, 55.331328251526465],
              [-2.6561784467249394, 55.6217431238072]
            ]
          ]
        }
      ])
    })
  })

  describe('parseGeoAreas', () => {
    let mockDb
    let mockLogger

    beforeEach(() => {
      mockDb = { collection: vi.fn() }
      mockLogger = { error: vi.fn() }
      vi.mocked(createLogger).mockReturnValue(mockLogger)
    })

    test('should throw error when exemption has no siteDetails', async () => {
      const exemption = { id: '123' }

      await expect(
        parseGeoAreas(exemption, mockDb, collectionMarinePlanAreas, {
          displayName: 'Marine Plan Areas'
        })
      ).rejects.toThrow(Boom.notFound('Exemption with site details not found'))
    })

    test('should process single coordinate sites and return marine plan areas', async () => {
      const exemption = {
        siteDetails: [mockSiteWGS84]
      }

      const mockCircleCoords = [[-0.23153, 51.489676]]

      vi.mocked(generateCirclePolygon).mockReturnValue(mockCircleCoords)
      vi.mocked(outputIntersectionAreas).mockResolvedValue(mockMarinePlanAreas)

      const result = await parseGeoAreas(
        exemption,
        mockDb,
        collectionMarinePlanAreas,
        {
          displayName: 'Marine Plan Areas'
        }
      )

      expect(outputIntersectionAreas).toHaveBeenCalledWith(
        mockDb,
        [
          {
            type: 'Polygon',
            coordinates: [mockCircleCoords]
          }
        ],
        collectionMarinePlanAreas
      )
      expect(result).toEqual(mockMarinePlanAreas)
    })

    test('should process multiple coordinate sites and return marine plan areas', async () => {
      const exemption = {
        siteDetails: [mockSiteMultipleWGS84]
      }

      vi.mocked(outputIntersectionAreas).mockResolvedValue(mockMarinePlanAreas)

      const result = await parseGeoAreas(
        exemption,
        mockDb,
        collectionMarinePlanAreas,
        {
          displayName: 'Marine Plan Areas'
        }
      )

      expect(outputIntersectionAreas).toHaveBeenCalledWith(
        mockDb,
        [
          {
            type: 'Polygon',
            coordinates: [
              [
                [-0.178408, 54.088594],
                [-0.177369, 54.086782],
                [-0.175219, 54.088057],
                [-0.178408, 54.088594]
              ]
            ]
          }
        ],
        collectionMarinePlanAreas
      )
      expect(result).toEqual(mockMarinePlanAreas)
    })

    test('should process file coordinate sites and return marine plan areas', async () => {
      const exemption = {
        siteDetails: [mockSiteFile]
      }

      vi.mocked(outputIntersectionAreas).mockResolvedValue(mockMarinePlanAreas)

      const result = await parseGeoAreas(
        exemption,
        mockDb,
        collectionMarinePlanAreas,
        {
          displayName: 'Marine Plan Areas'
        }
      )

      expect(outputIntersectionAreas).toHaveBeenCalledWith(
        mockDb,
        [
          {
            type: 'Polygon',
            coordinates: [
              [
                [-2.6561784467249394, 55.6217431238072],
                [-2.3132402554949936, 55.32224616938891],
                [-2.9479108792966926, 55.331328251526465],
                [-2.6561784467249394, 55.6217431238072]
              ]
            ]
          }
        ],
        collectionMarinePlanAreas
      )
      expect(result).toEqual(mockMarinePlanAreas)
    })

    test('should return empty array when there is an error', async () => {
      const exemption = {
        siteDetails: [mockSiteWGS84]
      }

      vi.mocked(outputIntersectionAreas).mockRejectedValue(
        new Error('Database connection failed')
      )

      const result = await parseGeoAreas(
        exemption,
        mockDb,
        collectionMarinePlanAreas,
        {
          displayName: 'Marine Plan Areas'
        }
      )

      expect(result).toEqual([])
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })
})
