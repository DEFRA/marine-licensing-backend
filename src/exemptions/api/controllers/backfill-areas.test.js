import { vi } from 'vitest'
import { backfillAreasController } from './backfill-areas.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { updateCoastalOperationsAreas } from '../../../shared/common/helpers/geo/update-coastal-operations-areas.js'
import { updateMarinePlanningAreas } from '../../../shared/common/helpers/geo/update-marine-planning-areas.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/index.js'
import { config } from '../../../config.js'
import { DYNAMICS_REQUEST_ACTIONS } from '../../../shared/common/constants/request-queue.js'

vi.mock('../../../shared/common/helpers/geo/update-coastal-operations-areas.js')
vi.mock('../../../shared/common/helpers/geo/update-marine-planning-areas.js')
vi.mock('../../../shared/common/helpers/dynamics/index.js')
vi.mock('../../../config.js')

describe('POST /exemption/backfill-areas', () => {
  let mockDb
  let mockHandler
  let mockExemptionId
  let mockLogger

  const activeExemption = {
    _id: null,
    applicationReference: 'EXE/2026/001',
    status: EXEMPTION_STATUS.ACTIVE,
    marinePlanAreas: ['South East Inshore']
  }

  beforeEach(() => {
    mockExemptionId = new ObjectId().toHexString()

    activeExemption._id = ObjectId.createFromHexString(mockExemptionId)

    mockHandler = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }

    mockDb = {
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn(),
        updateOne: vi.fn().mockResolvedValue(undefined)
      })
    }

    updateCoastalOperationsAreas.mockResolvedValue(undefined)
    updateMarinePlanningAreas.mockResolvedValue(undefined)
    vi.mocked(addToDynamicsQueue).mockResolvedValue(undefined)
    config.get.mockReturnValue({ isDynamicsEnabled: false })
  })

  it('should successfully backfill exemption areas', async () => {
    mockDb.collection().findOne.mockResolvedValue(activeExemption)

    const request = {
      payload: { id: mockExemptionId },
      db: mockDb,
      logger: mockLogger
    }

    await backfillAreasController.handler(request, mockHandler)

    expect(updateCoastalOperationsAreas).toHaveBeenCalledWith(
      activeExemption,
      mockDb,
      { updatedAt: undefined, updatedBy: undefined }
    )
    expect(updateMarinePlanningAreas).toHaveBeenCalledWith(
      activeExemption,
      mockDb,
      { updatedAt: undefined, updatedBy: undefined }
    )

    expect(mockDb.collection().updateOne).toHaveBeenCalledWith(
      { _id: activeExemption._id },
      { $set: { areaBackfillCompleteAt: expect.any(String) } }
    )

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: {
        applicationReference: 'EXE/2026/001',
        message: 'Backfill for Exemption is successful'
      }
    })
    expect(mockHandler.code).toHaveBeenCalledWith(200)
  })

  it('should throw error if exemption is not ACTIVE', async () => {
    mockDb.collection().findOne.mockResolvedValue({
      ...activeExemption,
      status: EXEMPTION_STATUS.DRAFT
    })

    const request = {
      payload: { id: mockExemptionId },
      db: mockDb,
      logger: mockLogger
    }

    await expect(
      backfillAreasController.handler(request, mockHandler)
    ).rejects.toThrow(
      Boom.badRequest(`Exemption is not in ${EXEMPTION_STATUS.ACTIVE}`)
    )
  })

  it('should throw error if exemption already has correct data', async () => {
    mockDb.collection().findOne.mockResolvedValue({
      ...activeExemption,
      marinePlanAreas: undefined,
      coastalOperationsAreas: undefined
    })

    const request = {
      payload: { id: mockExemptionId },
      db: mockDb,
      logger: mockLogger
    }

    await expect(
      backfillAreasController.handler(request, mockHandler)
    ).rejects.toThrow(Boom.badRequest('Exemption already has correct data'))
  })

  it('should throw error if exemption is not found', async () => {
    mockDb.collection().findOne.mockResolvedValue(null)

    const request = {
      payload: { id: mockExemptionId },
      db: mockDb,
      logger: mockLogger
    }

    await expect(
      backfillAreasController.handler(request, mockHandler)
    ).rejects.toThrow(
      Boom.notFound(`#findExemptionById not found for id ${mockExemptionId}`)
    )
  })

  it('should wrap generic errors in badImplementation', async () => {
    mockDb.collection().findOne.mockRejectedValue(new Error('DB failure'))

    const request = {
      payload: { id: mockExemptionId },
      db: mockDb,
      logger: mockLogger
    }

    try {
      await backfillAreasController.handler(request, mockHandler)
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error.isBoom).toBe(true)
      expect(error.output.statusCode).toBe(500)
      expect(error.message).toContain('Failed to backfill exemption')
    }
  })

  it('should call addToDynamicsQueue with UPDATE action when Dynamics is enabled', async () => {
    config.get.mockReturnValue({ isDynamicsEnabled: true })
    mockDb.collection().findOne.mockResolvedValue(activeExemption)

    const request = {
      payload: { id: mockExemptionId },
      db: mockDb,
      logger: mockLogger
    }

    await backfillAreasController.handler(request, mockHandler)

    expect(addToDynamicsQueue).toHaveBeenCalledWith({
      request,
      applicationReference: activeExemption.applicationReference,
      action: DYNAMICS_REQUEST_ACTIONS.UPDATE
    })
  })

  it('should not call addToDynamicsQueue when Dynamics is disabled', async () => {
    config.get.mockReturnValue({ isDynamicsEnabled: false })
    mockDb.collection().findOne.mockResolvedValue(activeExemption)

    const request = {
      payload: { id: mockExemptionId },
      db: mockDb,
      logger: mockLogger
    }

    await backfillAreasController.handler(request, mockHandler)

    expect(addToDynamicsQueue).not.toHaveBeenCalled()
  })
})
