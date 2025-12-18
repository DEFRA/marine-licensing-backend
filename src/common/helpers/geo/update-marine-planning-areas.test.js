import { describe, test, expect, vi, beforeEach } from 'vitest'
import Boom from '@hapi/boom'
import { updateMarinePlanningAreas } from './update-marine-planning-areas.js'
import { parseGeoAreas } from './geo-parse.js'
import { mockMarinePlanAreas } from './test.fixture.js'

vi.mock('./geo-parse.js')

describe('updateMarinePlanningAreas', () => {
  let mockDb
  let mockCollection
  let mockUpdatedAt
  let mockUpdatedBy

  beforeEach(() => {
    vi.clearAllMocks()

    mockCollection = {
      updateOne: vi.fn().mockResolvedValue({})
    }

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }

    mockUpdatedAt = new Date('2024-01-01T00:00:00.000Z')
    mockUpdatedBy = 'test-user'
  })

  test('should throw error when exemption is not provided', async () => {
    await expect(
      updateMarinePlanningAreas(null, mockDb, {
        updatedAt: mockUpdatedAt,
        updatedBy: mockUpdatedBy
      })
    ).rejects.toThrow(Boom.notFound('Exemption not found'))
  })

  test('should update exemption with marine plan areas when exemption is valid', async () => {
    const mockExemption = {
      _id: 'test-exemption-id',
      location: { coordinates: [1, 2] }
    }

    vi.mocked(parseGeoAreas).mockResolvedValue(mockMarinePlanAreas)

    await updateMarinePlanningAreas(mockExemption, mockDb, {
      updatedAt: mockUpdatedAt,
      updatedBy: mockUpdatedBy
    })

    expect(parseGeoAreas).toHaveBeenCalledWith(
      mockExemption,
      mockDb,
      'marine-plan-areas'
    )

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'test-exemption-id' },
      {
        $set: {
          marinePlanAreas: mockMarinePlanAreas,
          updatedAt: mockUpdatedAt,
          updatedBy: mockUpdatedBy
        }
      }
    )
  })
})
