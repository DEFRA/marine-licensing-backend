import { vi } from 'vitest'
import { withdrawExemptionController } from './withdraw-exemption'
import { addToDynamicsQueue } from '../../../common/helpers/dynamics'
import { addToEmpQueue } from '../../../common/helpers/emp/emp-processor.js'
import { config } from '../../../config.js'

vi.mock('../../../config.js')
vi.mock('../../../common/helpers/dynamics/index.js')
vi.mock('../../../common/helpers/emp/emp-processor.js')

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

  it('should return not found error if exemption does not exist', async () => {
    const { mockMongo, mockHandler } = global

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue(null)
      }
    })

    await expect(() =>
      withdrawExemptionController.handler(
        { db: mockMongo, params: { id: mockId }, payload: mockPayload },
        mockHandler
      )
    ).rejects.toThrow('Exemption not found during update')
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
