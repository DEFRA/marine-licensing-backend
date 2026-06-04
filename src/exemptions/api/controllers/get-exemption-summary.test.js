import { vi, expect } from 'vitest'
import Boom from '@hapi/boom'
import { getExemptionSummaryController } from './get-exemption-summary.js'
import { buildExemptionSummaryPipeline } from '../helpers/exemption-summary.js'
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

  it('returns status counts and report metrics for internal users', async () => {
    mockDb = {
      collection: vi.fn().mockReturnValue({
        aggregate: mockAggregate.mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              statusCounts: [
                { _id: EXEMPTION_STATUS.ACTIVE, count: 4 },
                { _id: EXEMPTION_STATUS.SUBMITTED, count: 2 },
                { _id: EXEMPTION_STATUS.DRAFT, count: 3 },
                { _id: EXEMPTION_STATUS.WITHDRAWN, count: 1 }
              ],
              shapefileExemptions: [{ count: 1 }],
              kmlExemptions: [{ count: 2 }],
              manualCoordinatesExemptions: [{ count: 3 }],
              coordinateSystemVolume: [
                { _id: 'wgs84', count: 4 },
                { _id: 'osgb36', count: 1 }
              ],
              byArticle: [{ _id: '25', count: 2 }],
              byMarinePlanArea: [{ _id: 'East inshore', count: 1 }],
              byCoastalOperationsArea: [{ _id: 'South', count: 1 }]
            }
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
        withdrawnExemptions: 1,
        coordinatesInputMethod: {
          shapefile: 1,
          kml: 2,
          manualCoordinates: 3
        },
        coordinateSystemVolume: {
          wgs84: { count: 4, percentage: 80 },
          bng: { count: 1, percentage: 20 },
          total: 5
        },
        byArticle: {
          25: 2
        },
        byMarinePlanArea: {
          'East inshore': 1
        },
        byCoastalOperationsArea: {
          South: 1
        }
      }
    })
    expect(mockHandler.code).toHaveBeenCalledWith(200)
    expect(mockAggregate).toHaveBeenCalledWith(buildExemptionSummaryPipeline())
  })

  it('returns zero counts when aggregation returns no documents', async () => {
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
        withdrawnExemptions: 0,
        coordinatesInputMethod: {
          shapefile: 0,
          kml: 0,
          manualCoordinates: 0
        },
        coordinateSystemVolume: {
          wgs84: { count: 0, percentage: 0 },
          bng: { count: 0, percentage: 0 },
          total: 0
        },
        byArticle: {},
        byMarinePlanArea: {},
        byCoastalOperationsArea: {}
      }
    })
  })

  it('returns zero counts when statuses are missing', async () => {
    mockDb = {
      collection: vi.fn().mockReturnValue({
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              statusCounts: [],
              shapefileExemptions: [],
              kmlExemptions: [],
              manualCoordinatesExemptions: [],
              coordinateSystemVolume: [],
              byArticle: [],
              byMarinePlanArea: [],
              byCoastalOperationsArea: []
            }
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
        submittedExemptions: 0,
        unsubmittedExemptions: 0,
        withdrawnExemptions: 0,
        coordinatesInputMethod: {
          shapefile: 0,
          kml: 0,
          manualCoordinates: 0
        },
        coordinateSystemVolume: {
          wgs84: { count: 0, percentage: 0 },
          bng: { count: 0, percentage: 0 },
          total: 0
        },
        byArticle: {},
        byMarinePlanArea: {},
        byCoastalOperationsArea: {}
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

  it('rethrows boom errors without additional logging', async () => {
    const boomError = Boom.badRequest('invalid aggregation')
    mockDb = {
      collection: vi.fn().mockReturnValue({
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockRejectedValue(boomError)
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
    ).rejects.toBe(boomError)
    expect(mockLogger.error).not.toHaveBeenCalled()
  })
})
