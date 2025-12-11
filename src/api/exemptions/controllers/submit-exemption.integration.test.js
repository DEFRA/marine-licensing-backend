import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi
} from 'vitest'
import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import {
  createCompleteExemption,
  mockCredentials
} from '../../../../tests/test.fixture.js'

describe('POST /exemption/submit', () => {
  let server
  let db
  let exemptionId
  let mockDate

  beforeAll(async () => {
    const { createServer } = await import('../../../server.js')
    server = await createServer()
    await server.initialize()
    db = globalThis.mockMongo

    mockDate = new Date('2025-06-15T10:30:00Z')
    vi.spyOn(global, 'Date').mockImplementation(function () {
      return mockDate
    })
    Date.now = vi.fn(() => mockDate.getTime())
  })

  afterAll(async () => {
    await server?.stop({ timeout: 1000 })
  })

  beforeEach(async () => {
    await db.collection('exemptions').deleteMany({})

    exemptionId = new ObjectId()
    const completeExemption = createCompleteExemption({
      _id: exemptionId,
      contactId: mockCredentials.contactId
    })

    await db.collection('exemptions').insertOne(completeExemption)
  })

  it('should successfully submit a complete exemption', async () => {
    const response = await server.inject({
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
      .collection('exemptions')
      .findOne({ _id: exemptionId })

    expect(updatedExemption.status).toBe(EXEMPTION_STATUS.ACTIVE)
    expect(updatedExemption.applicationReference).toEqual(
      mockApplicationReference
    )
    expect(updatedExemption.submittedAt).toEqual(mockDate)
    expect(updatedExemption.marinePlanAreas).toEqual([])
  })

  it('should return 404 if not found in database', async () => {
    await db.collection('exemptions').deleteMany({})

    const response = await server.inject({
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

    const response = await server.inject({
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
      .collection('exemptions')
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
})
