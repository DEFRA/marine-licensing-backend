import { describe, test, expect, vi, beforeEach } from 'vitest'
import Boom from '@hapi/boom'
import { outputIntersectionAreas } from './geo-search.js'
import { addBufferToShape } from './geo-utils.js'
import { mockFeatureCollection, mockMarinePlanAreas } from './test.fixture.js'

vi.mock('./geo-utils.js')

describe('geo-search', () => {
  let mockDb
  let mockCollection
  let mockFind
  let mockToArray

  const mockGeometry = mockFeatureCollection.features[0].geometry

  beforeEach(() => {
    vi.clearAllMocks()

    mockToArray = vi.fn()
    mockFind = vi.fn().mockReturnValue({
      toArray: mockToArray
    })

    mockCollection = {
      find: mockFind
    }

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }
  })

  describe('outputIntersectionAreas', () => {
    test('should query database and return deduplicated array of intersecting area names', async () => {
      const mockIntersectingAreas = mockMarinePlanAreas.map((name) => ({
        name
      }))

      vi.mocked(addBufferToShape).mockReturnValue(mockGeometry)
      mockToArray.mockResolvedValue(mockIntersectingAreas)

      const siteGeometries = mockFeatureCollection.features.map(
        (feature) => feature.geometry
      )

      const result = await outputIntersectionAreas(
        mockDb,
        siteGeometries,
        'marine-plan-areas'
      )

      expect(addBufferToShape).toHaveBeenCalledTimes(2)
      expect(mockDb.collection).toHaveBeenCalledWith('marine-plan-areas')
      expect(mockFind).toHaveBeenCalledTimes(2)
      expect(mockFind).toHaveBeenCalledWith(
        {
          geometry: {
            $geoIntersects: {
              $geometry: mockGeometry
            }
          }
        },
        {
          projection: { name: 1, _id: 0 }
        }
      )
      expect(result).toEqual(mockMarinePlanAreas)
    })

    test('should throw Boom error when database query fails', async () => {
      vi.mocked(addBufferToShape).mockReturnValue(mockGeometry)
      const dbError = new Error('Database error')
      mockToArray.mockRejectedValue(dbError)

      const siteGeometries = [mockFeatureCollection.features[0].geometry]

      await expect(
        outputIntersectionAreas(mockDb, siteGeometries, 'marine-plan-areas')
      ).rejects.toThrow(
        Boom.internal('Error searching coordinates: Database error')
      )

      expect(addBufferToShape).toHaveBeenCalledWith(
        mockFeatureCollection.features[0].geometry,
        50
      )
      expect(mockFind).toHaveBeenCalledTimes(1)
    })
  })
})
