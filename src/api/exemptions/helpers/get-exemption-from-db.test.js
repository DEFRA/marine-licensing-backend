import { vi } from 'vitest'
import { getExemptionFromDb } from './get-exemption-from-db.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'

describe('getExemptionFromDb', () => {
  let mockDb
  let mockCollection

  beforeEach(() => {
    mockCollection = {
      findOne: vi.fn()
    }

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }
  })

  it('should return exemption when found', async () => {
    const exemptionId = '507f1f77bcf86cd799439011'
    const mockExemption = {
      _id: ObjectId.createFromHexString(exemptionId),
      projectName: 'Test Project'
    }

    mockCollection.findOne.mockResolvedValue(mockExemption)

    const request = {
      params: { id: exemptionId },
      db: mockDb
    }

    const result = await getExemptionFromDb(request)

    expect(result).toEqual(mockExemption)
    expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
    expect(mockCollection.findOne).toHaveBeenCalledWith({
      _id: ObjectId.createFromHexString(exemptionId)
    })
  })

  it('should throw 404 when exemption not found', async () => {
    mockCollection.findOne.mockResolvedValue(null)
    const boomSpy = vi.spyOn(Boom, 'notFound')

    const request = {
      params: { id: '507f1f77bcf86cd799439011' },
      db: mockDb
    }

    await expect(getExemptionFromDb(request)).rejects.toThrow()

    expect(boomSpy).toHaveBeenCalledWith('Exemption not found')
  })

  it('should throw when id is invalid ObjectId', async () => {
    const request = {
      params: { id: 'invalid-id' },
      db: mockDb
    }

    await expect(getExemptionFromDb(request)).rejects.toThrow()
  })
})
