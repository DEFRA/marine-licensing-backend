import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import {
  createCompleteExemption,
  mockCredentials
} from '../../../../tests/test.fixture.js'
import { setupTestServer } from '../../../../tests/test-server.js'

describe('POST /exemption/submit', async () => {
  const getServer = await setupTestServer()
  let db
  let exemptionId
  let mockDate

  beforeAll(async () => {
    db = globalThis.mockMongo
    mockDate = new Date('2025-06-15T10:30:00Z')
    vi.spyOn(global, 'Date').mockImplementation(function () {
      return mockDate
    })
    Date.now = vi.fn(() => mockDate.getTime())
  })

  beforeEach(async () => {
    exemptionId = new ObjectId()
    const completeExemption = createCompleteExemption({
      _id: exemptionId,
      contactId: mockCredentials.contactId
    })

    await db.collection(collectionExemptions).insertOne(completeExemption)
  })

  it('should successfully submit a complete exemption', async () => {
    const response = await getServer().inject({
      method: 'POST',
      url: '/exemption/submit',
      payload: {
        id: exemptionId.toHexString(),
        userEmail: 'test@example.com',
        userName: 'Test User'
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(200)

    const payload = JSON.parse(response.payload)

    const mockApplicationReference = 'EXE/2025/10001'

    expect(payload).toEqual({
      message: 'success',
      value: {
        applicationReference: mockApplicationReference,
        submittedAt: mockDate.toISOString()
      }
    })

    const updatedExemption = await db
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })

    expect(updatedExemption.status).toBe(EXEMPTION_STATUS.ACTIVE)
    expect(updatedExemption.applicationReference).toEqual(
      mockApplicationReference
    )
    expect(updatedExemption.submittedAt).toEqual(mockDate)
    expect(updatedExemption.marinePlanAreas).toEqual([])
  })

  it('should return 404 if not found in database', async () => {
    await db.collection(collectionExemptions).deleteMany({})

    const response = await getServer().inject({
      method: 'POST',
      url: '/exemption/submit',
      payload: {
        id: exemptionId.toHexString(),
        userEmail: 'test@example.com',
        userName: 'Test User'
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(404)
  })

  it('should successfully submit a complete exemption with marine plan areas', async () => {
    await db.collection('marine-plan-areas').insertMany([
      {
        name: 'South East Inshore',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-0.3, 51.4],
              [-0.1, 51.4],
              [-0.1, 51.55],
              [-0.3, 51.55],
              [-0.3, 51.4]
            ]
          ]
        }
      },
      {
        name: 'South East offshore',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-0.35, 51.45],
              [-0.15, 51.45],
              [-0.15, 51.52],
              [-0.35, 51.52],
              [-0.35, 51.45]
            ]
          ]
        }
      }
    ])

    const response = await getServer().inject({
      method: 'POST',
      url: '/exemption/submit',
      payload: {
        id: exemptionId.toHexString(),
        userEmail: 'test@example.com',
        userName: 'Test User'
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(200)

    const mockApplicationReference = 'EXE/2025/10002'

    const payload = JSON.parse(response.payload)

    expect(payload).toEqual({
      message: 'success',
      value: {
        applicationReference: mockApplicationReference,
        submittedAt: mockDate.toISOString()
      }
    })

    const updatedExemption = await db
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })

    expect(updatedExemption.status).toBe(EXEMPTION_STATUS.ACTIVE)
    expect(updatedExemption.applicationReference).toEqual(
      mockApplicationReference
    )
    expect(updatedExemption.submittedAt).toEqual(mockDate)
    expect(updatedExemption.marinePlanAreas).toEqual([
      'South East Inshore',
      'South East offshore'
    ])
  })

  it('assigns unique references when many exemptions submit in parallel (reference lock contention)', async () => {
    const parallelCount = 8
    const year = mockDate.getFullYear()
    const sequenceKey = `EXEMPTION_${year}`

    await db.collection(collectionExemptions).deleteMany({
      contactId: mockCredentials.contactId
    })
    await db.collection('reference-sequences').deleteMany({ key: sequenceKey })

    const ids = []
    for (let i = 0; i < parallelCount; i++) {
      const id = new ObjectId()
      ids.push(id)
      await db.collection(collectionExemptions).insertOne(
        createCompleteExemption({
          _id: id,
          contactId: mockCredentials.contactId
        })
      )
    }

    const server = getServer()
    const responses = await Promise.all(
      ids.map((id) =>
        server.inject({
          method: 'POST',
          url: '/exemption/submit',
          payload: {
            id: id.toHexString(),
            userEmail: 'parallel@example.com',
            userName: 'Parallel User'
          },
          auth: {
            strategy: 'jwt',
            credentials: mockCredentials
          }
        })
      )
    )

    for (const res of responses) {
      expect(res.statusCode).toBe(200)
    }

    const refs = responses.map(
      (r) => JSON.parse(r.payload).value.applicationReference
    )
    expect(new Set(refs).size).toBe(parallelCount)

    const nums = refs.map((ref) => Number.parseInt(ref.split('/')[2], 10))
    nums.sort((a, b) => a - b)
    for (let i = 0; i < parallelCount; i++) {
      expect(nums[i]).toBe(10001 + i)
    }
  }, 30_000)
})
