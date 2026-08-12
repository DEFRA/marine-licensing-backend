import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { versionedUpdate } from './versionedUpdate.js'

describe('versionedUpdate', () => {
  const id = new ObjectId().toHexString()
  const _id = ObjectId.createFromHexString(id)
  const sitePath = 'siteDetails.0'
  const expectedUpdatedAt = new Date('2024-12-01T10:00:00Z')
  const updateOps = { $set: { siteDetailsConfirmed: false } }

  const mockDbFor = (updateOneResult) => {
    const mockUpdateOne = vi.fn().mockResolvedValueOnce(updateOneResult)
    const mockDb = {
      collection: vi.fn().mockReturnValue({ updateOne: mockUpdateOne })
    }
    return { mockDb, mockUpdateOne }
  }

  it('resolves with the update result when the write matches', async () => {
    const { mockDb, mockUpdateOne } = mockDbFor({ matchedCount: 1 })

    const result = await versionedUpdate({
      db: mockDb,
      collectionName: 'marine-licences',
      id,
      _id,
      sitePath,
      expectedUpdatedAt,
      updateOps
    })

    expect(result).toEqual({ matchedCount: 1 })
    expect(mockDb.collection).toHaveBeenCalledWith('marine-licences')
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id, [sitePath]: { $exists: true }, updatedAt: expectedUpdatedAt },
      updateOps
    )
  })

  it('throws a conflict naming the marine licence id when nothing matches the expected version', async () => {
    const { mockDb } = mockDbFor({ matchedCount: 0 })

    vi.spyOn(Boom, 'conflict')

    await expect(() =>
      versionedUpdate({
        db: mockDb,
        collectionName: 'marine-licences',
        id,
        _id,
        sitePath,
        expectedUpdatedAt,
        updateOps
      })
    ).rejects.toThrow(`Marine Licence ${id} was modified by another user`)
  })
})
