import { describe, test, expect, vi, beforeEach } from 'vitest'
import { parseGeoAreas } from './geo-parse.js'
import { mockCoastalAreas } from './test.fixture.js'
import { updateCoastalOperationsAreas } from './update-coastal-operations-areas.js'

vi.mock('./geo-parse.js')

describe('updateCoastalOperationsAreas', () => {
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

  test('should update exemption with Coastal Operations Areas when exemption is valid', async () => {
    const mockExemption = {
      _id: 'test-exemption-id',
      location: { coordinates: [1, 2] }
    }

    vi.mocked(parseGeoAreas).mockResolvedValue(mockCoastalAreas)

    await updateCoastalOperationsAreas(mockExemption, mockDb, {
      updatedAt: mockUpdatedAt,
      updatedBy: mockUpdatedBy
    })

    expect(parseGeoAreas).toHaveBeenCalledWith(
      mockExemption,
      mockDb,
      'coastal-operations-areas',
      { displayName: 'Coastal Operations Areas' }
    )

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'test-exemption-id' },
      {
        $set: {
          coastalOperationsAreas: mockCoastalAreas,
          updatedAt: mockUpdatedAt,
          updatedBy: mockUpdatedBy
        }
      }
    )
  })

  test('should update exemption but skip parsing when no Coastal Operations Areas exist in collection', async () => {
    const mockExemption = {
      _id: 'test-exemption-id',
      location: { coordinates: [1, 2] }
    }

    mockCountDocuments.mockReturnValueOnce(0)
    const parseMock = vi.mocked(parseGeoAreas)

    await updateCoastalOperationsAreas(mockExemption, mockDb, {
      updatedAt: mockUpdatedAt,
      updatedBy: mockUpdatedBy
    })

    expect(parseMock).not.toHaveBeenCalled()

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'test-exemption-id' },
      {
        $set: {
          coastalOperationsAreas: [],
          updatedAt: mockUpdatedAt,
          updatedBy: mockUpdatedBy
        }
      }
    )
  })
})
