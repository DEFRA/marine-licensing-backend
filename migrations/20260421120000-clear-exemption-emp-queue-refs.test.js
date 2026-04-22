import { describe, expect, test, vi } from 'vitest'
import { collectionEmpQueue } from '../src/shared/common/constants/db-collections.js'
import { up } from './20260421120000-clear-exemption-emp-queue-refs.js'

const expectedApplicationReferences = [
  'EXE/2026/10034',
  'EXE/2026/10014',
  'EXE/2026/10010',
  'EXE/2026/10029',
  'EXE/2025/10014'
]

describe('20260421120000-clear-exemption-emp-queue-refs', () => {
  test('up issues deleteMany on exemption-emp-queue for the hardcoded application references', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ deletedCount: 1 })
    const collection = vi.fn().mockReturnValue({ deleteMany })
    const db = { collection }

    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      await up(db)
    } finally {
      info.mockRestore()
    }

    expect(collection).toHaveBeenCalledWith(collectionEmpQueue)
    expect(deleteMany).toHaveBeenCalledWith({
      applicationReferenceNumber: { $in: expectedApplicationReferences }
    })
  })
})
