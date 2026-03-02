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
        id: marineLicenceId.toHexString()
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

    expect(updatedMarineLicence.status).toBe(MARINE_LICENCE_STATUS.ACTIVE)
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
        id: marineLicenceId.toHexString()
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
          status: MARINE_LICENCE_STATUS.ACTIVE
        }
      }
    )

    const response = await getServer().inject({
      method: 'POST',
      url: '/marine-licence/submit',
      payload: {
        id: marineLicenceId.toHexString()
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(409)
  })
})
