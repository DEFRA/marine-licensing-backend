import { describe, test, expect, vi, beforeEach } from 'vitest'
import { updateMarinePlanningAreas } from './update-marine-planning-areas.js'
import { parseGeoAreas } from './geo-parse.js'
import { mockMarinePlanAreas } from './test.fixture.js'

vi.mock('./geo-parse.js')

describe('updateMarinePlanningAreas', () => {
  let mockDb
  let mockCollection
  let mockUpdatedAt
  let mockUpdatedBy
  const mockCountDocuments = vi.fn().mockResolvedValue(4)

  beforeEach(() => {
    vi.clearAllMocks()

    mockCollection = {
      countDocuments: mockCountDocuments,
      updateOne: vi.fn().mockResolvedValue({})
    }

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }

    mockUpdatedAt = new Date('2024-01-01T00:00:00.000Z')
    mockUpdatedBy = 'test-user'
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
      'marine-plan-areas',
      { displayName: 'Marine Plan Areas' }
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

  test('should update exemption but skip parsing when no Marine Plan areas exist in collection', async () => {
    const mockExemption = {
      _id: 'test-exemption-id',
      location: { coordinates: [1, 2] }
    }

    mockCountDocuments.mockReturnValueOnce(0)
    const parseMock = vi.mocked(parseGeoAreas)

    await updateMarinePlanningAreas(mockExemption, mockDb, {
      updatedAt: mockUpdatedAt,
      updatedBy: mockUpdatedBy
    })

    expect(parseMock).not.toHaveBeenCalled()

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'test-exemption-id' },
      {
        $set: {
          marinePlanAreas: [],
          updatedAt: mockUpdatedAt,
          updatedBy: mockUpdatedBy
        }
      }
    )
  })
})
