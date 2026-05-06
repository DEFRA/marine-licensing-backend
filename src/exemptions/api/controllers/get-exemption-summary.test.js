import { vi, expect } from 'vitest'
import Boom from '@hapi/boom'
import { getExemptionSummaryController } from './get-exemption-summary.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'

describe('GET /exemptions/summary', () => {
  let mockDb
  let mockHandler
  let mockAggregate

  beforeEach(() => {
    mockAggregate = vi.fn()
    mockHandler = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }
  })

  it('returns status counts for internal users', async () => {
    mockDb = {
      collection: vi.fn().mockReturnValue({
        aggregate: mockAggregate.mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { _id: EXEMPTION_STATUS.ACTIVE, count: 4 },
            { _id: EXEMPTION_STATUS.SUBMITTED, count: 2 },
            { _id: EXEMPTION_STATUS.DRAFT, count: 3 },
            { _id: EXEMPTION_STATUS.WITHDRAWN, count: 1 }
          ])
        })
      })
    }

    const request = {
      db: mockDb,
      auth: { artifacts: { decoded: { tid: 'entra-tenant-id' } } }
    }

    await getExemptionSummaryController.handler(request, mockHandler)

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: {
        submittedExemptions: 6,
        unsubmittedExemptions: 3,
        withdrawnExemptions: 1
      }
    })
    expect(mockHandler.code).toHaveBeenCalledWith(200)
    expect(mockAggregate).toHaveBeenCalledWith([
      {
        $match: {
          status: {
            $in: [
              EXEMPTION_STATUS.ACTIVE,
              EXEMPTION_STATUS.SUBMITTED,
              EXEMPTION_STATUS.DRAFT,
              EXEMPTION_STATUS.WITHDRAWN
            ]
          }
        }
      },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  })

  it('returns zero counts when statuses are missing', async () => {
    mockDb = {
      collection: vi.fn().mockReturnValue({
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        })
      })
    }

    const request = {
      db: mockDb,
      auth: { artifacts: { decoded: { tid: 'entra-tenant-id' } } }
    }

    await getExemptionSummaryController.handler(request, mockHandler)

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: {
        submittedExemptions: 0,
        unsubmittedExemptions: 0,
        withdrawnExemptions: 0
      }
    })
  })

  it('returns forbidden for applicant users', async () => {
    mockDb = {
      collection: vi.fn()
    }
    const request = {
      db: mockDb,
      auth: { artifacts: { decoded: {} } }
    }

    await expect(
      getExemptionSummaryController.handler(request, mockHandler)
    ).rejects.toThrow(Boom.forbidden('Not authorised to request this resource'))

    expect(mockDb.collection).not.toHaveBeenCalled()
  })

  it('returns internal server error when aggregation fails', async () => {
    mockDb = {
      collection: vi.fn().mockReturnValue({
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockRejectedValue(new Error('db unavailable'))
        })
      })
    }

    const request = {
      db: mockDb,
      auth: { artifacts: { decoded: { tid: 'entra-tenant-id' } } }
    }

    await expect(
      getExemptionSummaryController.handler(request, mockHandler)
    ).rejects.toThrow('Error retrieving exemption summary: db unavailable')
  })
})
