import { vi } from 'vitest'
import {
  getStatusFilter,
  getUserFilter,
  queryEmployeeCollections
} from './utils'
import {
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'

describe('getUserFilter', () => {
  const testContactId = 'contact-123-abc'
  const testUsers = ['9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d']

  test('returns a contactId filter for the current user when show is my-projects', () => {
    const result = getUserFilter('my-projects', testContactId, testUsers)
    expect(result).toEqual({ contactId: testContactId })
  })

  test('returns a contactId filter for the current user when show is missing', () => {
    const result = getUserFilter(undefined, testContactId, undefined)
    expect(result).toEqual({ contactId: testContactId })
  })

  test('returns a filter over the specified users when show is specific-user', () => {
    const result = getUserFilter('specific-user', testContactId, testUsers)
    expect(result).toEqual({ contactId: { $in: testUsers } })
  })

  test('returns a $in filter over multiple specified users', () => {
    const multipleUsers = [
      '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      'e2c1a2a0-6b1a-4c1a-8b1a-6b1a4c1a8b1a'
    ]
    const result = getUserFilter('specific-user', testContactId, multipleUsers)
    expect(result).toEqual({ contactId: { $in: multipleUsers } })
  })

  test('returns no filter when show is specific-user but no user is checked', () => {
    const result = getUserFilter('specific-user', testContactId, undefined)
    expect(result).toEqual({})
  })

  test('returns no filter when show is specific-user and user is an empty array', () => {
    const result = getUserFilter('specific-user', testContactId, [])
    expect(result).toEqual({})
  })
})

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

describe('queryEmployeeCollections', () => {
  const orgFilter = { 'organisation.id': 'test-org-id' }

  const createMockCollection = (toArrayResult) => ({
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(toArrayResult)
      })
    })
  })

  const createMockDb = (exemptionResults, marineLicenceResults) => {
    const mockExemptionCollection = createMockCollection(exemptionResults)
    const mockMarineLicenceCollection =
      createMockCollection(marineLicenceResults)

    return {
      mockExemptionCollection,
      mockMarineLicenceCollection,
      db: {
        collection: vi.fn((name) => {
          if (name === collectionExemptions) return mockExemptionCollection
          if (name === collectionMarineLicences) {
            return mockMarineLicenceCollection
          }
          return createMockCollection([])
        })
      }
    }
  }

  test('queries both collections when type is absent', async () => {
    const { db, mockExemptionCollection, mockMarineLicenceCollection } =
      createMockDb([{ id: 'exemption-1' }], [{ id: 'licence-1' }])

    const [empExemptions, empMarineLicences] = await queryEmployeeCollections(
      db,
      orgFilter,
      undefined
    )

    expect(mockExemptionCollection.find).toHaveBeenCalledWith(orgFilter)
    expect(mockMarineLicenceCollection.find).toHaveBeenCalledWith(orgFilter)
    expect(empExemptions).toEqual([{ id: 'exemption-1' }])
    expect(empMarineLicences).toEqual([{ id: 'licence-1' }])
  })

  test('only queries exemptions when type narrows to exemption', async () => {
    const { db, mockExemptionCollection, mockMarineLicenceCollection } =
      createMockDb([{ id: 'exemption-1' }], [])

    const [empExemptions, empMarineLicences] = await queryEmployeeCollections(
      db,
      orgFilter,
      ['exemption']
    )

    expect(mockExemptionCollection.find).toHaveBeenCalledWith(orgFilter)
    expect(mockMarineLicenceCollection.find).not.toHaveBeenCalled()
    expect(empExemptions).toEqual([{ id: 'exemption-1' }])
    expect(empMarineLicences).toEqual([])
  })

  test('only queries marine licences when type narrows to marine-licence', async () => {
    const { db, mockExemptionCollection, mockMarineLicenceCollection } =
      createMockDb([], [{ id: 'licence-1' }])

    const [empExemptions, empMarineLicences] = await queryEmployeeCollections(
      db,
      orgFilter,
      ['marine-licence']
    )

    expect(mockMarineLicenceCollection.find).toHaveBeenCalledWith(orgFilter)
    expect(mockExemptionCollection.find).not.toHaveBeenCalled()
    expect(empExemptions).toEqual([])
    expect(empMarineLicences).toEqual([{ id: 'licence-1' }])
  })

  test('queries both collections when type includes both values', async () => {
    const { db, mockExemptionCollection, mockMarineLicenceCollection } =
      createMockDb([{ id: 'exemption-1' }], [{ id: 'licence-1' }])

    const [empExemptions, empMarineLicences] = await queryEmployeeCollections(
      db,
      orgFilter,
      ['exemption', 'marine-licence']
    )

    expect(mockExemptionCollection.find).toHaveBeenCalledWith(orgFilter)
    expect(mockMarineLicenceCollection.find).toHaveBeenCalledWith(orgFilter)
    expect(empExemptions).toEqual([{ id: 'exemption-1' }])
    expect(empMarineLicences).toEqual([{ id: 'licence-1' }])
  })
})
