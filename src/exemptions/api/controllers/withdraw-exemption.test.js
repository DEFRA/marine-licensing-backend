import { vi } from 'vitest'
import { withdrawExemptionController } from './withdraw-exemption'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/index.js'
import { addToEmpQueue } from '../../../shared/common/helpers/emp/index.js'
import { config } from '../../../config.js'
import { WITHDRAWABLE_STATUSES } from '../../constants/exemption.js'

vi.mock('../../../config.js')
vi.mock('../../../shared/common/helpers/dynamics/index.js')
vi.mock('../../../shared/common/helpers/emp/emp-processor.js')

describe('POST /exemption/{id}/withdraw', () => {
  let dynamicsMock
  let empMock

  beforeEach(() => {
    config.get.mockImplementation(function (key) {
      if (key === 'dynamics') {
        return {
          isDynamicsEnabled: false,
          apiKey: 'test-api-key',
          retryIntervalSeconds: 1,
          retries: 1
        }
      }
      if (key === 'exploreMarinePlanning') {
        return {
          isEmpEnabled: false
        }
      }
      return {}
    })

    dynamicsMock = vi.mocked(addToDynamicsQueue)
    empMock = vi.mocked(addToEmpQueue)
  })

  const paramsValidator = withdrawExemptionController.options.validate.params

  const mockId = '123456789123456789123456'

  const withdrawWith = async (findOneAndUpdate) => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return { findOneAndUpdate }
    })

    return withdrawExemptionController.handler(
      {
        db: mockMongo,
        params: { id: mockId },
        payload: { updatedAt: new Date(), updatedBy: 'user123' }
      },
      mockHandler
    )
  }

  it('should fail if fields are missing', () => {
    const result = paramsValidator.validate({})

    expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
  })

  it('should fail if fields are incorrect length', () => {
    const result = paramsValidator.validate({ id: '123' })

    expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
  })

  it('should fail if id has incorrect characters', () => {
    const result = paramsValidator.validate({ id: mockId.replace('1', '+') })

    expect(result.error.message).toContain('EXEMPTION_ID_INVALID')
  })

  it('rejects withdrawal when the status does not qualify', async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue(null)

    await expect(withdrawWith(findOneAndUpdate)).rejects.toMatchObject({
      output: { statusCode: 409 }
    })
  })

  it('filters on withdrawable statuses so the check cannot race the write', async () => {
    const findOneAndUpdate = vi
      .fn()
      .mockResolvedValue({ applicationReference: 'EXE/2026/00001' })

    await withdrawWith(findOneAndUpdate)

    const [filter] = findOneAndUpdate.mock.calls[0]
    expect(filter.status).toEqual({ $in: WITHDRAWABLE_STATUSES })
  })

  it('does not queue Dynamics or EMP messages when withdrawal is rejected', async () => {
    config.get.mockImplementation((key) =>
      key === 'dynamics' ? { isDynamicsEnabled: true } : { isEmpEnabled: true }
    )
    const findOneAndUpdate = vi.fn().mockResolvedValue(null)

    await expect(withdrawWith(findOneAndUpdate)).rejects.toThrow()

    expect(dynamicsMock).not.toHaveBeenCalled()
    expect(empMock).not.toHaveBeenCalled()
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global

    const mockError = 'Database failed'

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      withdrawExemptionController.handler(
        { db: mockMongo, params: { id: mockId }, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow(
      `Error when attempting to withdraw exemption: ${mockError}`
    )
  })

  it('should insert dynamics and EMP queue documents regardless of organisation', async () => {
    const { mockMongo, mockHandler } = global

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    const mockExemption = { id: 'test', applicationReference: 'mock-ref' }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue(mockExemption)
      }
    })

    config.get.mockImplementation(function (key) {
      if (key === 'dynamics') {
        return {
          isDynamicsEnabled: true,
          apiKey: 'test-api-key',
          retryIntervalSeconds: 1,
          retries: 1
        }
      }
      if (key === 'exploreMarinePlanning') {
        return {
          isEmpEnabled: true
        }
      }
      return {}
    })

    const mockRequest = {
      db: mockMongo,
      params: { id: mockId },
      payload: mockPayload
    }

    await withdrawExemptionController.handler(mockRequest, mockHandler)

    expect(dynamicsMock).toHaveBeenCalledWith({
      request: mockRequest,
      applicationReference: 'mock-ref',
      action: 'withdraw'
    })

    expect(empMock).toHaveBeenCalledWith({
      request: mockRequest,
      applicationReference: 'mock-ref',
      action: 'withdraw'
    })
  })

  it('should not insert EMP queue document when EMP is disabled', async () => {
    const { mockMongo, mockHandler } = global

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    const mockExemption = { id: 'test', applicationReference: 'mock-ref' }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue(mockExemption)
      }
    })

    config.get.mockImplementation(function (key) {
      if (key === 'dynamics') {
        return { isDynamicsEnabled: false }
      }
      if (key === 'exploreMarinePlanning') {
        return { isEmpEnabled: false }
      }
      return {}
    })

    const mockRequest = {
      db: mockMongo,
      params: { id: mockId },
      payload: mockPayload
    }

    await withdrawExemptionController.handler(mockRequest, mockHandler)

    expect(empMock).not.toHaveBeenCalled()
  })
})
