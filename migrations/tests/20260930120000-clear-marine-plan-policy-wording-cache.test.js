import { up } from '../20260930120000-clear-marine-plan-policy-wording-cache.js'
import { collectionMarinePlanPolicyWording } from '../../src/shared/common/constants/db-collections.js'

describe('20260930120000-clear-marine-plan-policy-wording-cache', () => {
  it('should remove every cached wording row so the next lookup refetches the dataset', async () => {
    const cache = global.mockMongo.collection(collectionMarinePlanPolicyWording)
    await cache.insertMany([
      { _id: 'E-AGG-1', policy: '<p>x</p>', fetchedAt: new Date() },
      { _id: 'E-AGG-2', notFound: true, fetchedAt: new Date() }
    ])

    await up(global.mockMongo)

    expect(await cache.countDocuments()).toBe(0)
  })
})
