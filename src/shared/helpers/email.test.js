import { vi } from 'vitest'
import { sendEmail } from './email.js'
import { config } from '../../config.js'
import { NotifyClient } from 'notifications-node-client'
import { createLogger } from '../common/helpers/logging/logger.js'
import { retryAsyncOperation } from '../common/helpers/retry-async-operation.js'

vi.mock('../../config.js')
vi.mock('notifications-node-client', () => ({
  NotifyClient: vi.fn(function () {})
}))
vi.mock('../common/helpers/logging/logger.js', async () => {
  const actual = await vi.importActual('../common/helpers/logging/logger.js')
  return {
    ...actual,
    createLogger: vi.fn(function () {})
  }
})
vi.mock('../common/helpers/retry-async-operation.js')

describe('sendEmail', () => {
  let mockNotifyClient
  let mockLogger
  let mockConfig

  const templateId = 'template-id'
  const userEmail = 'jane@example.com'
  const applicationReference = 'ML/2025/10001'
  const projectType = 'marine-licence'
  const personalisation = {
    name: 'Jane Doe',
    reference: applicationReference,
    viewDetailsUrl: 'https://example.com/marine-licence/view-details/abc123'
  }

  beforeEach(() => {
    retryAsyncOperation.mockImplementation(({ operation }) => operation())

    mockNotifyClient = {
      sendEmail: vi.fn()
    }
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }
    mockConfig = {
      apiKey: 'test-api-key',
      retryIntervalSeconds: 1,
      retries: 1
    }

    config.get.mockImplementation((key) => {
      if (key === 'notify') return mockConfig
      return {}
    })
    NotifyClient.mockImplementation(function () {
      return mockNotifyClient
    })
    createLogger.mockReturnValue(mockLogger)
  })

  it('should send email with personalisation and log success', async () => {
    mockNotifyClient.sendEmail.mockResolvedValue({ data: { id: 'notify-id' } })

    const result = await sendEmail({
      templateId,
      userEmail,
      personalisation,
      applicationReference,
      projectType
    })

    expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
      templateId,
      userEmail,
      {
        personalisation,
        reference: applicationReference
      }
    )

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'gov-notify',
        operation: 'sendEmail',
        applicationReference
      }),
      `Sent confirmation email for ${projectType} ${applicationReference}`
    )

    expect(result).toEqual({
      status: 'success',
      id: 'notify-id',
      reference: applicationReference
    })
  })

  it('should handle no API key being present', async () => {
    delete mockConfig.apiKey

    await expect(() =>
      sendEmail({
        templateId,
        userEmail,
        personalisation,
        applicationReference,
        projectType
      })
    ).rejects.toThrow('Notify API key is not set')
  })

  it('should handle Notify errors and return an error result', async () => {
    const mockError = {
      response: {
        data: {
          errors: [{ error: 'BadRequestError', message: 'Invalid email' }]
        }
      }
    }
    mockNotifyClient.sendEmail.mockRejectedValue(mockError)

    const result = await sendEmail({
      templateId,
      userEmail: 'bad-email',
      personalisation,
      applicationReference,
      projectType
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Error sending email'),
          code: 'EMAIL_SEND_ERROR'
        }),
        service: 'gov-notify',
        operation: 'sendEmail',
        applicationReference
      }),
      `Error sending email for ${projectType} ${applicationReference}`
    )

    expect(result).toEqual({
      status: 'error',
      errors: JSON.stringify(mockError.response.data.errors),
      reference: applicationReference
    })
  })

  it('should preserve existing error code when Error already has one', async () => {
    const errorWithCode = Object.assign(new Error('pre-coded error'), {
      code: 'EXISTING_CODE',
      statusCode: 500
    })
    vi.mocked(retryAsyncOperation).mockRejectedValue(errorWithCode)

    await sendEmail({
      templateId,
      userEmail: 'bad-email',
      personalisation,
      applicationReference,
      projectType
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EXISTING_CODE' })
      }),
      `Error sending email for ${projectType} ${applicationReference}`
    )
  })

  it('should handle Notify errors when not an Error object', async () => {
    vi.mocked(retryAsyncOperation).mockRejectedValue({
      message: 'unexpected failure',
      code: 500
    })

    const result = await sendEmail({
      templateId,
      userEmail: 'bad-email',
      personalisation,
      applicationReference,
      projectType
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Error sending email'),
          code: 'EMAIL_SEND_ERROR'
        }),
        service: 'gov-notify',
        operation: 'sendEmail',
        applicationReference
      }),
      `Error sending email for ${projectType} ${applicationReference}`
    )

    expect(result).toEqual({
      status: 'error',
      errors: undefined,
      reference: applicationReference
    })
  })
})
