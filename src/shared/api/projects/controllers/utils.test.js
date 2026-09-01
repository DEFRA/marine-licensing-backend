import { getStatusFilter } from './utils'

describe('getStatusFilter', async () => {
  test('handle no status', async () => {
    const result = getStatusFilter()
    expect(result).toEqual({})
  })

  test('handle single status', async () => {
    const result = getStatusFilter(['DRAFT'])
    expect(result).toEqual({ status: { $in: ['DRAFT'] } })
  })

  test('handle multiple status values', async () => {
    const result = getStatusFilter(['ACTIVE', 'DRAFT'])
    expect(result).toEqual({ status: { $in: ['ACTIVE', 'DRAFT'] } })
  })
})
