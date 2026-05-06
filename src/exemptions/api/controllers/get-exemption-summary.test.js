import { vi, expect } from 'vitest'
import { getExemptionSummaryController } from './get-exemption-summary.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'

describe('GET /exemptions/summary', () => {
  let mockDb
  let mockHandler
  let mockAggregate
  let mockLogger

  beforeEach(() => {
    mockAggregate = vi.fn()
    mockLogger = {
      error: vi.fn()
    }
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
      auth: { artifacts: { decoded: { tid: 'entra-tenant-id' } } },
      logger: mockLogger
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
      auth: { artifacts: { decoded: { tid: 'entra-tenant-id' } } },
      logger: mockLogger
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
      auth: { artifacts: { decoded: { tid: 'entra-tenant-id' } } },
      logger: mockLogger
    }

    await expect(
      getExemptionSummaryController.handler(request, mockHandler)
    ).rejects.toThrow('Error retrieving exemption summary: db unavailable')
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'db unavailable',
          type: 'Error',
          stack_trace: expect.any(String)
        })
      }),
      'Failed to retrieve exemption summary'
    )
  })
})
