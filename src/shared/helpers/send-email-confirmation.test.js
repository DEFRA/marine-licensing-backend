import { vi } from 'vitest'
import { sendEmailConfirmation } from './send-email-confirmation.js'
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

describe('sendEmailConfirmation', () => {
  let mockDb
  let mockCollection
  let mockNotifyClient
  let mockLogger
  let mockConfig

  beforeEach(() => {
    retryAsyncOperation.mockImplementation(({ operation }) => operation())

    mockCollection = {
      insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' })
    }
    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }
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
      retries: 1,
      exemption: {
        notifyTemplateId: '123',
        notifyTemplateIdEmployee: '456',
        notifyTemplateIdAgent: '789'
      },
      marineLicence: {
        notifyTemplateId: 'ml-123',
        notifyTemplateIdEmployee: 'ml-456',
        notifyTemplateIdAgent: 'ml-789'
      }
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

  it('should send email with viewDetailsUrl and log success', async () => {
    mockNotifyClient.sendEmail.mockResolvedValue({ data: { id: 'notify-id' } })

    await sendEmailConfirmation({
      db: mockDb,
      userName: 'Jane Doe',
      userEmail: 'jane@example.com',
      organisation: null,
      applicationReference: 'ML/2025/10001',
      viewDetailsUrl: 'https://example.com/marine-licence/view-details/abc123',
      projectType: 'marine-licence'
    })

    expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
      mockConfig.marineLicence.notifyTemplateId,
      'jane@example.com',
      {
        personalisation: {
          name: 'Jane Doe',
          reference: 'ML/2025/10001',
          viewDetailsUrl:
            'https://example.com/marine-licence/view-details/abc123',
          organisationName: undefined
        },
        reference: 'ML/2025/10001'
      }
    )

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'gov-notify',
        operation: 'sendEmail',
        applicationReference: 'ML/2025/10001'
      }),
      'Sent confirmation email for marine-licence ML/2025/10001'
    )

    expect(mockCollection.insertOne).toHaveBeenCalledWith({
      applicationReferenceNumber: 'ML/2025/10001',
      status: 'success',
      id: 'notify-id',
      reference: 'ML/2025/10001'
    })
  })

  it('should handle no API key being present', async () => {
    delete mockConfig.apiKey

    await expect(() =>
      sendEmailConfirmation({
        db: mockDb,
        userName: 'Jane Doe',
        userEmail: 'bad-email',
        organisation: null,
        applicationReference: 'ML/2025/10002',
        viewDetailsUrl:
          'https://example.com/marine-licence/view-details/abc123',
        projectType: 'marine-licence'
      })
    ).rejects.toThrow(`Notify API key is not set`)
  })

  it('should handle Notify errors and log to database', async () => {
    const mockError = {
      response: {
        data: {
          errors: [{ error: 'BadRequestError', message: 'Invalid email' }]
        }
      }
    }
    mockNotifyClient.sendEmail.mockRejectedValue(mockError)

    await sendEmailConfirmation({
      db: mockDb,
      userName: 'Jane Doe',
      userEmail: 'bad-email',
      organisation: null,
      applicationReference: 'ML/2025/10002',
      viewDetailsUrl: 'https://example.com/marine-licence/view-details/abc123',
      projectType: 'marine-licence'
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Error sending email'),
          code: 'EMAIL_SEND_ERROR'
        }),
        service: 'gov-notify',
        operation: 'sendEmail',
        applicationReference: 'ML/2025/10002'
      }),
      'Error sending email for marine-licence ML/2025/10002'
    )

    expect(mockCollection.insertOne).toHaveBeenCalledWith({
      applicationReferenceNumber: 'ML/2025/10002',
      status: 'error',
      errors: JSON.stringify(mockError.response.data.errors),
      reference: 'ML/2025/10002'
    })
  })

  it('should preserve existing error code when Error already has one', async () => {
    const errorWithCode = Object.assign(new Error('pre-coded error'), {
      code: 'EXISTING_CODE',
      statusCode: 500
    })
    vi.mocked(retryAsyncOperation).mockRejectedValue(errorWithCode)

    await sendEmailConfirmation({
      db: mockDb,
      userName: 'Jane Doe',
      userEmail: 'bad-email',
      organisation: null,
      applicationReference: 'ML/2025/10002',
      viewDetailsUrl: 'https://example.com/marine-licence/view-details/abc123',
      projectType: 'marine-licence'
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EXISTING_CODE' })
      }),
      'Error sending email for marine-licence ML/2025/10002'
    )
  })

  it('should handle Notify errors and log to database when not error object', async () => {
    vi.mocked(retryAsyncOperation).mockRejectedValue({
      message: 'unexpected failure',
      code: 500
    })

    await sendEmailConfirmation({
      db: mockDb,
      userName: 'Jane Doe',
      userEmail: 'bad-email',
      organisation: null,
      applicationReference: 'ML/2025/10002',
      viewDetailsUrl: 'https://example.com/marine-licence/view-details/abc123',
      projectType: 'marine-licence'
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Error sending email'),
          code: 'EMAIL_SEND_ERROR'
        }),
        service: 'gov-notify',
        operation: 'sendEmail',
        applicationReference: 'ML/2025/10002'
      }),
      'Error sending email for marine-licence ML/2025/10002'
    )

    expect(mockCollection.insertOne).toHaveBeenCalledWith({
      applicationReferenceNumber: 'ML/2025/10002',
      status: 'error',
      errors: undefined,
      reference: 'ML/2025/10002'
    })
  })

  it('should use employee template for employee organisations (exemption)', async () => {
    mockNotifyClient.sendEmail.mockResolvedValue({ data: { id: 'id-emp' } })

    await sendEmailConfirmation({
      db: mockDb,
      userName: 'Bob',
      userEmail: 'bob@org.com',
      organisation: { name: 'Acme Ltd', userRelationshipType: 'Employee' },
      applicationReference: 'EXM/2025/10003',
      viewDetailsUrl: 'https://example.com/exemption/view-details/xyz',
      projectType: 'exemption'
    })

    expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
      mockConfig.exemption.notifyTemplateIdEmployee,
      'bob@org.com',
      expect.objectContaining({
        personalisation: expect.objectContaining({
          organisationName: 'Acme Ltd'
        })
      })
    )
  })

  it('should use marine-licence agent template for marine-licence agent or intermediary', async () => {
    mockNotifyClient.sendEmail.mockResolvedValue({ data: { id: 'id-ml' } })

    await sendEmailConfirmation({
      db: mockDb,
      userName: 'Bob',
      userEmail: 'bob@org.com',
      organisation: { name: 'Acme Ltd', userRelationshipType: 'Agent' },
      applicationReference: 'MLA/2025/10004',
      viewDetailsUrl: 'https://example.com/marine-licence/view-details/xyz',
      projectType: 'marine-licence'
    })

    expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
      mockConfig.marineLicence.notifyTemplateIdAgent,
      'bob@org.com',
      expect.any(Object)
    )
  })

  it('should use marine-licence employee template for marine-licence employee organisations', async () => {
    mockNotifyClient.sendEmail.mockResolvedValue({ data: { id: 'id-ml' } })

    await sendEmailConfirmation({
      db: mockDb,
      userName: 'Bob',
      userEmail: 'bob@org.com',
      organisation: { name: 'Acme Ltd', userRelationshipType: 'Employee' },
      applicationReference: 'MLA/2025/10004',
      viewDetailsUrl: 'https://example.com/marine-licence/view-details/xyz',
      projectType: 'marine-licence'
    })

    expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
      mockConfig.marineLicence.notifyTemplateIdEmployee,
      'bob@org.com',
      expect.any(Object)
    )
  })
})
