import { describe, test, expect, vi, beforeEach } from 'vitest'
import { parseGeoAreas } from './geo-parse.js'
import { mockCoastalAreas } from './test.fixture.js'
import { updateCoastalEnforcementAreas } from './update-coastal-enforcement-areas.js'

vi.mock('./geo-parse.js')

describe('updateCoastalEnforcementAreas', () => {
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

  test('should update exemption with Coastal Enforcement Areas when exemption is valid', async () => {
    const mockExemption = {
      _id: 'test-exemption-id',
      location: { coordinates: [1, 2] }
    }

    vi.mocked(parseGeoAreas).mockResolvedValue(mockCoastalAreas)

    await updateCoastalEnforcementAreas(mockExemption, mockDb, {
      updatedAt: mockUpdatedAt,
      updatedBy: mockUpdatedBy
    })

    expect(parseGeoAreas).toHaveBeenCalledWith(
      mockExemption,
      mockDb,
      'coastal-enforcement-areas',
      { displayName: 'Coastal Enforcement Areas' }
    )

    expect(mockCollection.updateOne).toHaveBeenCalledWith(
      { _id: 'test-exemption-id' },
      {
        $set: {
          coastalEnforcementAreas: mockCoastalAreas,
          updatedAt: mockUpdatedAt,
          updatedBy: mockUpdatedBy
        }
      }
    )
  })
})
