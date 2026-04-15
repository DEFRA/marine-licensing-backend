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

    const draftExemptionIds = []
    for (let i = 0; i < parallelCount; i++) {
      const draftExemptionId = new ObjectId()
      draftExemptionIds.push(draftExemptionId)
      await db.collection(collectionExemptions).insertOne(
        createCompleteExemption({
          _id: draftExemptionId,
          contactId: mockCredentials.contactId
        })
      )
    }

    const server = getServer()
    const submitResponses = await Promise.all(
      draftExemptionIds.map((draftExemptionId) =>
        server.inject({
          method: 'POST',
          url: '/exemption/submit',
          payload: {
            id: draftExemptionId.toHexString(),
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

    for (const response of submitResponses) {
      expect(response.statusCode).toBe(200)
    }

    const applicationReferences = submitResponses.map((response) => {
      const body = JSON.parse(response.payload)
      return body.value.applicationReference
    })
    // Parallel submits must not reuse the same reference. A Set drops duplicates, so its size stays parallelCount only when every reference is distinct.
    expect(new Set(applicationReferences).size).toBe(parallelCount)

    // Distinct references alone do not prove the DB sequence advanced correctly (e.g. gaps or wrong start).
    // References look like EXE/{year}/{sequence}. Parse the numeric segment, sort, then each expect() checks
    // we received the next contiguous values starting at expectedFirstSequenceNumber (through 10001 + parallelCount - 1).
    const sequenceSegmentIndex = 2
    const expectedFirstSequenceNumber = 10001
    const sequenceNumbersAscending = applicationReferences
      .map((reference) => {
        const segments = reference.split('/')
        const sequenceSegment = segments[sequenceSegmentIndex]
        return Number.parseInt(sequenceSegment, 10)
      })
      .sort((a, b) => a - b)
    for (let i = 0; i < parallelCount; i++) {
      expect(sequenceNumbersAscending[i]).toBe(expectedFirstSequenceNumber + i)
    }
  }, 30_000)
})
