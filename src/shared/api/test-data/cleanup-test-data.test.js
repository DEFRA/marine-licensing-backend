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
  it('is enabled only for CDP dev and test', () => {
    expect(isCleanupEndpointEnabled('dev')).toBe(true)
    expect(isCleanupEndpointEnabled('test')).toBe(true)
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

  it('deletes only the configured contactId data on test', async () => {
    const journeyContactId = '11111111-1111-1111-1111-111111111111'
    const otherContactId = '22222222-2222-2222-2222-222222222222'

    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'journeyTestContactId') return journeyContactId
      return undefined
    })

    const db = createDb()
    db.seed(collectionExemptions, [
      {
        contactId: journeyContactId,
        applicationReference: 'EXE/KEEP-REF'
      },
      {
        contactId: otherContactId,
        applicationReference: 'EXE/OTHER'
      }
    ])
    db.seed(collectionMarineLicences, [
      {
        contactId: journeyContactId,
        applicationReference: 'MLA/KEEP-REF'
      },
      { contactId: otherContactId, applicationReference: 'MLA/OTHER' }
    ])
    db.seed(collectionEmpQueue, [
      { applicationReferenceNumber: 'EXE/KEEP-REF' },
      { applicationReferenceNumber: 'EXE/OTHER' }
    ])
    db.seed(collectionDynamicsQueue, [
      { applicationReferenceNumber: 'MLA/KEEP-REF' },
      { applicationReferenceNumber: 'MLA/OTHER' }
    ])

    const result = await cleanupTestData(db)

    expect(result.environment).toBe('test')
    expect(result.contactId).toBe(journeyContactId)
    expect(result.deleted[collectionExemptions]).toBe(1)
    expect(result.deleted[collectionMarineLicences]).toBe(1)
    expect(result.deleted[collectionEmpQueue]).toBe(1)
    expect(result.deleted[collectionDynamicsQueue]).toBe(1)

    expect(db.docs(collectionExemptions)).toEqual([
      { contactId: otherContactId, applicationReference: 'EXE/OTHER' }
    ])
    expect(db.docs(collectionMarineLicences)).toEqual([
      { contactId: otherContactId, applicationReference: 'MLA/OTHER' }
    ])
    expect(db.docs(collectionEmpQueue)).toEqual([
      { applicationReferenceNumber: 'EXE/OTHER' }
    ])
    expect(db.docs(collectionDynamicsQueue)).toEqual([
      { applicationReferenceNumber: 'MLA/OTHER' }
    ])
  })

  it('throws when test contactId is not configured', async () => {
    vi.mocked(config.get).mockImplementation((key) => {
      if (key === 'cdpEnvironment') return 'test'
      if (key === 'journeyTestContactId') return ''
      return undefined
    })

    const db = createDb()

    await expect(cleanupTestData(db)).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 500 }
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
