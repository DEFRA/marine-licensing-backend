import { vi } from 'vitest'
import { StatusCodes } from 'http-status-codes'
import { withdrawMarineLicenceController } from './withdraw-marine-licence.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { lifecycleStatusIs } from '../helpers/lifecycle-status.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { config } from '../../../config.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/index.js'
import {
  DYNAMICS_QUEUE_TYPES,
  DYNAMICS_REQUEST_ACTIONS
} from '../../../shared/common/constants/request-queue.js'

vi.mock('../../../config.js')
vi.mock('../../../shared/common/helpers/dynamics/index.js')

describe('POST /marine-licence/{id}/withdraw', () => {
  const paramsValidator =
    withdrawMarineLicenceController.options.validate.params

  const mockId = '123456789123456789123456'

  const mockLogger = { info: vi.fn(), error: vi.fn() }

  const setDynamicsEnabled = (isDynamicsEnabled) =>
    config.get.mockImplementation((key) =>
      key === 'dynamics' ? { isDynamicsEnabled } : {}
    )

  beforeEach(() => {
    setDynamicsEnabled(false)
  })

  const buildRequest = (db) => ({
    db,
    logger: mockLogger,
    params: { id: mockId },
    payload: {
      updatedAt: new Date('2026-08-07T00:00:00.000Z'),
      updatedBy: 'user123'
    }
  })

  it('should fail if fields are missing', () => {
    const result = paramsValidator.validate({})

    expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  it('should fail if fields are incorrect length', () => {
    const result = paramsValidator.validate({ id: '123' })

    expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  it('should fail if id has incorrect characters', () => {
    const result = paramsValidator.validate({ id: mockId.replace('1', '+') })

    expect(result.error.message).toContain('MARINE_LICENCE_ID_INVALID')
  })

  it('should set the withdrawn status and withdrawal date, matching only submitted applications', async () => {
    const { mockMongo, mockHandler } = global

    const findOneAndUpdate = vi.fn().mockResolvedValue({
      _id: mockId,
      applicationReference: 'MLA/2026/10002'
    })

    const collection = vi
      .spyOn(mockMongo, 'collection')
      .mockImplementation(function () {
        return { findOneAndUpdate }
      })

    const request = buildRequest(mockMongo)
    await withdrawMarineLicenceController.handler(request, mockHandler)

    expect(collection).toHaveBeenCalledWith(collectionMarineLicences)

    const [filter, [{ $set: update }]] = findOneAndUpdate.mock.calls[0]

    expect(filter).toEqual({
      _id: expect.anything(),
      ...lifecycleStatusIs(MARINE_LICENCE_STATUS.SUBMITTED)
    })
    expect(update).toEqual({
      withdrawnAt: expect.any(Date),
      status: MARINE_LICENCE_STATUS.WITHDRAWN,
      previousStatus: '$$REMOVE',
      updatedAt: request.payload.updatedAt,
      updatedBy: 'user123'
    })
  })

  it('should respond with the withdrawal date', async () => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue({ _id: mockId })
      }
    })

    await withdrawMarineLicenceController.handler(
      buildRequest(mockMongo),
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: { withdrawnAt: expect.any(String) }
    })
    expect(mockHandler.code).toHaveBeenCalledWith(StatusCodes.OK)
  })

  it('should queue the withdrawal for Dynamics when the integration is enabled', async () => {
    const { mockMongo, mockHandler } = global

    setDynamicsEnabled(true)

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue({
          _id: mockId,
          applicationReference: 'MLA/2026/11883'
        })
      }
    })

    const request = buildRequest(mockMongo)
    await withdrawMarineLicenceController.handler(request, mockHandler)

    expect(addToDynamicsQueue).toHaveBeenCalledWith({
      request,
      applicationReference: 'MLA/2026/11883',
      action: DYNAMICS_REQUEST_ACTIONS.WITHDRAW,
      type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
    })
  })

  it('should not queue the withdrawal for Dynamics when the integration is disabled', async () => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue({
          _id: mockId,
          applicationReference: 'MLA/2026/11883'
        })
      }
    })

    await withdrawMarineLicenceController.handler(
      buildRequest(mockMongo),
      mockHandler
    )

    expect(addToDynamicsQueue).not.toHaveBeenCalled()
  })

  it('should return a bad request error when the application is not submitted', async () => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue(null)
      }
    })

    await expect(() =>
      withdrawMarineLicenceController.handler(
        buildRequest(mockMongo),
        mockHandler
      )
    ).rejects.toThrow(
      `Cannot withdraw marine licence as marine licence must be the status '${MARINE_LICENCE_STATUS.SUBMITTED}'.`
    )
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      withdrawMarineLicenceController.handler(
        buildRequest(mockMongo),
        mockHandler
      )
    ).rejects.toThrow(
      `Error when attempting to withdraw marine licence: ${mockError}`
    )
  })
})
