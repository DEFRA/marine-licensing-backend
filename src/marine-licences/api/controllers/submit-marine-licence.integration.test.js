import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import {
  createCompleteMarineLicence,
  mockCredentials
} from '../../../../tests/test.fixture.js'
import { setupTestServer } from '../../../../tests/test-server.js'

describe('POST /marine-licence/submit', async () => {
  const getServer = await setupTestServer()
  let db
  let marineLicenceId
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
    marineLicenceId = new ObjectId()

    const completeMarineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId: mockCredentials.contactId
    })

    await db
      .collection(collectionMarineLicences)
      .insertOne(completeMarineLicence)
  })

  it('should successfully submit a complete marine licence', async () => {
    const response = await getServer().inject({
      method: 'POST',
      url: '/marine-licence/submit',
      payload: {
        id: marineLicenceId.toHexString(),
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

    const mockApplicationReference = 'MLA/2025/10001'

    expect(payload).toEqual({
      message: 'success',
      value: {
        applicationReference: mockApplicationReference,
        submittedAt: mockDate.toISOString()
      }
    })

    const updatedMarineLicence = await db
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedMarineLicence.status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)
    expect(updatedMarineLicence.applicationReference).toEqual(
      mockApplicationReference
    )
    expect(updatedMarineLicence.submittedAt).toEqual(mockDate)
  })

  it('should return 404 if marine licence not found in database', async () => {
    await db.collection(collectionMarineLicences).deleteMany({})

    const response = await getServer().inject({
      method: 'POST',
      url: '/marine-licence/submit',
      payload: {
        id: marineLicenceId.toHexString(),
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

  it('should return 409 if marine licence has already been submitted', async () => {
    await db.collection(collectionMarineLicences).updateOne(
      { _id: marineLicenceId },
      {
        $set: {
          applicationReference: 'MLA/2025/10001',
          status: MARINE_LICENCE_STATUS.SUBMITTED
        }
      }
    )

    const response = await getServer().inject({
      method: 'POST',
      url: '/marine-licence/submit',
      payload: {
        id: marineLicenceId.toHexString(),
        userEmail: 'test@example.com',
        userName: 'Test User'
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(409)
  })

  it('assigns unique references when many marine licences submit in parallel (reference lock contention)', async () => {
    const parallelCount = 8
    const year = mockDate.getFullYear()
    const sequenceKey = `MARINE_LICENCE_${year}`

    await db.collection(collectionMarineLicences).deleteMany({
      contactId: mockCredentials.contactId
    })
    await db.collection('reference-sequences').deleteMany({ key: sequenceKey })

    const draftMarineLicenceIds = []
    for (let i = 0; i < parallelCount; i++) {
      const draftMarineLicenceId = new ObjectId()
      draftMarineLicenceIds.push(draftMarineLicenceId)
      await db.collection(collectionMarineLicences).insertOne(
        createCompleteMarineLicence({
          _id: draftMarineLicenceId,
          contactId: mockCredentials.contactId
        })
      )
    }

    const server = getServer()
    const submitResponses = await Promise.all(
      draftMarineLicenceIds.map((draftMarineLicenceId) =>
        server.inject({
          method: 'POST',
          url: '/marine-licence/submit',
          payload: {
            id: draftMarineLicenceId.toHexString(),
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
    // References look like MLA/{year}/{sequence}. Parse the numeric segment, sort, then each expect() checks
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
