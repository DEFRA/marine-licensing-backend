import { vi } from 'vitest'
import { withdrawExemptionController } from './withdraw-exemption'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/index.js'
import { addToEmpQueue } from '../../../shared/common/helpers/emp/index.js'
import { config } from '../../../config.js'
import { publishPublicRegisterWithdrawnEvent } from '../helpers/publish-public-register-event.js'

vi.mock('../../../config.js')
vi.mock('../../../shared/common/helpers/dynamics/index.js')
vi.mock('../../../shared/common/helpers/emp/emp-processor.js')
vi.mock('../helpers/publish-public-register-event.js')

describe('POST /exemption/{id}/withdraw', () => {
  let dynamicsMock
  let empMock

  beforeEach(() => {
    config.get.mockImplementation(function (key) {
      if (key === 'publicRegister') {
        return { isSnsEnabled: true }
      }
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

  it('publishes a withdrawn event when public register consent was given', async () => {
    const { mockMongo, mockHandler } = global

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    const mockExemption = {
      id: 'test',
      applicationReference: 'EXE/2026/00012',
      projectName: 'South coast sea samples',
      marinePlanAreas: ['South'],
      submittedAt: new Date('2026-03-18T10:00:00.000Z'),
      publicRegister: { consent: 'yes' }
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue(mockExemption)
      }
    })

    const mockRequest = {
      db: mockMongo,
      params: { id: mockId },
      payload: mockPayload,
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await withdrawExemptionController.handler(mockRequest, mockHandler)

    expect(publishPublicRegisterWithdrawnEvent).toHaveBeenCalledWith({
      applicationId: mockId,
      applicationReference: 'EXE/2026/00012',
      projectName: 'South coast sea samples',
      marinePlanAreas: ['South'],
      submittedAt: mockExemption.submittedAt,
      logger: mockRequest.logger
    })
  })

  it('does not publish a withdrawn event when public register consent was not given', async () => {
    const { mockMongo, mockHandler } = global

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    const mockExemption = {
      id: 'test',
      applicationReference: 'EXE/2026/00012',
      publicRegister: { consent: 'no' }
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue(mockExemption)
      }
    })

    const mockRequest = {
      db: mockMongo,
      params: { id: mockId },
      payload: mockPayload,
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await withdrawExemptionController.handler(mockRequest, mockHandler)

    expect(publishPublicRegisterWithdrawnEvent).not.toHaveBeenCalled()
  })

  it('does not publish a withdrawn event when publicRegister field is missing from exemption', async () => {
    const { mockMongo, mockHandler } = global

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    const mockExemption = {
      id: 'test',
      applicationReference: 'EXE/2026/00012',
      projectName: 'South coast sea samples'
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue(mockExemption)
      }
    })

    const mockRequest = {
      db: mockMongo,
      params: { id: mockId },
      payload: mockPayload,
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await withdrawExemptionController.handler(mockRequest, mockHandler)

    expect(publishPublicRegisterWithdrawnEvent).not.toHaveBeenCalled()
  })

  it('uses empty array for marinePlanAreas when exemption has no marinePlanAreas', async () => {
    const { mockMongo, mockHandler } = global

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    const mockExemption = {
      id: 'test',
      applicationReference: 'EXE/2026/00012',
      projectName: 'South coast sea samples',
      submittedAt: new Date('2026-03-18T10:00:00.000Z'),
      publicRegister: { consent: 'yes' }
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue(mockExemption)
      }
    })

    const mockRequest = {
      db: mockMongo,
      params: { id: mockId },
      payload: mockPayload,
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await withdrawExemptionController.handler(mockRequest, mockHandler)

    expect(publishPublicRegisterWithdrawnEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        marinePlanAreas: []
      })
    )
  })

  it('does not publish a withdrawn event when PUBLIC_REGISTER_SNS_ENABLED is false', async () => {
    config.get.mockImplementation(function (key) {
      if (key === 'publicRegister') {
        return { isSnsEnabled: false }
      }
      if (key === 'dynamics') {
        return { isDynamicsEnabled: false }
      }
      if (key === 'exploreMarinePlanning') {
        return { isEmpEnabled: false }
      }
      return {}
    })

    const { mockMongo, mockHandler } = global

    const mockPayload = {
      updatedAt: new Date(),
      updatedBy: 'user123'
    }

    const mockExemption = {
      id: 'test',
      applicationReference: 'EXE/2026/00012',
      projectName: 'South coast sea samples',
      marinePlanAreas: ['South'],
      submittedAt: new Date('2026-03-18T10:00:00.000Z'),
      publicRegister: { consent: 'yes' }
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOneAndUpdate: vi.fn().mockResolvedValue(mockExemption)
      }
    })

    const mockRequest = {
      db: mockMongo,
      params: { id: mockId },
      payload: mockPayload,
      logger: { info: vi.fn(), error: vi.fn() }
    }

    await withdrawExemptionController.handler(mockRequest, mockHandler)

    expect(publishPublicRegisterWithdrawnEvent).not.toHaveBeenCalled()
  })
})
