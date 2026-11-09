import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collectionDynamicsQueue,
  collectionDynamicsQueueFailed,
  collectionEmpQueue,
  collectionEmpQueueFailed,
  collectionExemptions,
  collectionMarineLicences
} from '../../common/constants/db-collections.js'

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

vi.mock('../../common/helpers/logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn()
  })
}))

const { config } = await import('../../../config.js')
const { cleanupTestData, isCleanupEndpointEnabled } =
  await import('./cleanup-test-data.js')

const createDb = () => {
  const collections = new Map()

  const collection = (name) => {
    if (!collections.has(name)) {
      const state = { docs: [] }
      collections.set(name, {
        state,
        api: {
          find: (filter = {}) => ({
            toArray: async () =>
              state.docs.filter((doc) =>
                Object.entries(filter).every(
                  ([key, value]) => doc[key] === value
                )
              )
          }),
          deleteMany: async (filter = {}) => {
            const before = state.docs.length
            if (Object.keys(filter).length === 0) {
              state.docs = []
              return { deletedCount: before }
            }
            const remaining = []
            let deletedCount = 0
            for (const doc of state.docs) {
              const matches = Object.entries(filter).every(([key, value]) => {
                if (key === 'applicationReferenceNumber' && value?.$in) {
                  return value.$in.includes(doc.applicationReferenceNumber)
                }
                return doc[key] === value
              })
              if (matches) {
                deletedCount += 1
              } else {
                remaining.push(doc)
              }
            }
            state.docs = remaining
            return { deletedCount }
          },
          aggregate: () => ({
            toArray: async () => []
          }),
          insertMany: async (docs) => {
            state.docs.push(...docs)
          }
        }
      })
    }
    return collections.get(name).api
  }

  return {
    collection,
    seed: (name, docs) => {
      collection(name)
      collections.get(name).state.docs.push(...docs)
    },
    docs: (name) => collections.get(name)?.state.docs ?? []
  }
}

describe('isCleanupEndpointEnabled', () => {
  it('is enabled only for CDP dev', () => {
    expect(isCleanupEndpointEnabled('dev')).toBe(true)
    expect(isCleanupEndpointEnabled('test')).toBe(false)
    expect(isCleanupEndpointEnabled('local')).toBe(false)
    expect(isCleanupEndpointEnabled('prod')).toBe(false)
    expect(isCleanupEndpointEnabled('perf-test')).toBe(false)
  })
})

describe('cleanupTestData', () => {
  beforeEach(() => {
    vi.mocked(config.get).mockReset()
  })

  it('deletes all project and queue documents on dev', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'cdpEnvironment') return 'dev'
      return undefined
    })

    const db = createDb()
    db.seed(collectionExemptions, [
      { contactId: 'a', applicationReference: 'EXE/1' },
      { contactId: 'b', applicationReference: 'EXE/2' }
    ])
    db.seed(collectionMarineLicences, [
      { contactId: 'a', applicationReference: 'MLA/1' }
    ])
    db.seed(collectionEmpQueue, [
      { applicationReferenceNumber: 'EXE/1' },
      { applicationReferenceNumber: 'EXE/2' }
    ])
    db.seed(collectionEmpQueueFailed, [{ applicationReferenceNumber: 'EXE/1' }])
    db.seed(collectionDynamicsQueue, [{ applicationReferenceNumber: 'EXE/2' }])
    db.seed(collectionDynamicsQueueFailed, [
      { applicationReferenceNumber: 'MLA/1' }
    ])

    const result = await cleanupTestData(db)

    expect(result.environment).toBe('dev')
    expect(result.contactId).toBeNull()
    expect(result.deleted).toEqual({
      [collectionExemptions]: 2,
      [collectionMarineLicences]: 1,
      [collectionEmpQueue]: 2,
      [collectionEmpQueueFailed]: 1,
      [collectionDynamicsQueue]: 1,
      [collectionDynamicsQueueFailed]: 1
    })
    expect(db.docs(collectionExemptions)).toEqual([])
    expect(db.docs(collectionMarineLicences)).toEqual([])
    expect(db.docs(collectionEmpQueue)).toEqual([])
  })

  it('throws not found on test so shared example data is preserved', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'cdpEnvironment') return 'test'
      return undefined
    })

    await expect(cleanupTestData(createDb())).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 404 }
    })
  })

  it('throws not found when cleanup is disabled for the environment', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'cdpEnvironment') return 'prod'
      return undefined
    })

    await expect(cleanupTestData(createDb())).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 404 }
    })
  })
})
