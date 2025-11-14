import { vi } from 'vitest'
import { sendUserEmailConfirmation } from './send-user-email-confirmation.js'
import { config } from '../../../config.js'
import { NotifyClient } from 'notifications-node-client'
import { createLogger } from '../../../common/helpers/logging/logger.js'

vi.mock('../../../config.js')
vi.mock('notifications-node-client')
vi.mock('../../../common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(),
  structureErrorForECS: vi.fn((error) => ({
    error: {
      message: error?.message || String(error),
      stack_trace: error?.stack,
      type: error?.name || error?.constructor?.name || 'Error',
      code: error?.code || error?.statusCode
    }
  }))
}))

describe('sendUserEmailConfirmation', () => {
  let mockDb
  let mockCollection
  let mockNotifyClient
  let mockLogger
  let mockConfig

  beforeEach(() => {
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
      notifyTemplateId: '123',
      notifyTemplateIdEmployee: '456',
      notifyTemplateIdAgent: '789'
    }

    config.get.mockImplementation((key) => {
      if (key === 'notify') {
        return mockConfig
      }
      if (key === 'notify.notifyTemplateId') {
        return mockConfig.notifyTemplateId
      }
      if (key === 'notify.notifyTemplateIdEmployee') {
        return mockConfig.notifyTemplateIdEmployee
      }
      if (key === 'notify.notifyTemplateIdAgent') {
        return mockConfig.notifyTemplateIdAgent
      }
      return {}
    })
    NotifyClient.mockImplementation(() => mockNotifyClient)
    createLogger.mockReturnValue(mockLogger)
  })

  describe('Happy Path - Successful Email Sending', () => {
    it('should send email successfully and log to database', async () => {
      const mockEmailResponse = {
        data: {
          id: 'notification-id-123'
        }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'John Doe',
        userEmail: 'john.doe@example.com',
        organisation: null,
        applicationReference: 'EXE/2025/10001',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439011'
      }

      await sendUserEmailConfirmation(params)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sent confirmation email for exemption EXE/2025/10001'
      )

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        mockConfig.notifyTemplateId,
        'john.doe@example.com',
        {
          personalisation: {
            name: 'John Doe',
            reference: 'EXE/2025/10001',
            viewDetailsUrl:
              'https://marine-licensing.defra.gov.uk/exemption/view-details/507f1f77bcf86cd799439011',
            organisationName: undefined
          },
          reference: 'EXE/2025/10001'
        }
      )

      expect(mockDb.collection).toHaveBeenCalledWith('email-queue')
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        applicationReferenceNumber: 'EXE/2025/10001',
        status: 'success',
        id: 'notification-id-123',
        reference: 'EXE/2025/10001'
      })
    })

    it('should handle emails with special characters in name', async () => {
      const mockEmailResponse = {
        data: {
          id: 'notification-id-456'
        }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'José María García-López',
        userEmail: 'jose.garcia@example.com',
        applicationReference: 'EXE/2025/10002',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439012'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        expect.anything(),
        'jose.garcia@example.com',
        expect.anything()
      )
    })

    it('should send email successfully with applicant organisation name', async () => {
      const mockEmailResponse = {
        data: {
          id: 'notification-id-with-org'
        }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'Jane Doe',
        userEmail: 'jane.doe@example.com',
        organisation: {
          id: 'org-456',
          name: 'Test Organisation Ltd',
          userRelationshipType: 'Employee'
        },
        applicationReference: 'EXE/2025/10099',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439099'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        mockConfig.notifyTemplateIdEmployee,
        'jane.doe@example.com',
        {
          personalisation: {
            name: 'Jane Doe',
            reference: 'EXE/2025/10099',
            viewDetailsUrl:
              'https://marine-licensing.defra.gov.uk/exemption/view-details/507f1f77bcf86cd799439099',
            organisationName: 'Test Organisation Ltd'
          },
          reference: 'EXE/2025/10099'
        }
      )
    })
  })

  describe('Error Handling - Notify API Failures', () => {
    it('should handle Notify API errors and log to database', async () => {
      const mockError = {
        response: {
          data: {
            errors: [
              {
                error: 'BadRequestError',
                message: 'Invalid email address'
              }
            ]
          }
        }
      }

      mockNotifyClient.sendEmail.mockRejectedValue(mockError)

      const params = {
        db: mockDb,
        userName: 'Jane Smith',
        userEmail: 'invalid-email',
        applicationReference: 'EXE/2025/10003',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439013'
      }

      await sendUserEmailConfirmation(params)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Error sending email'),
            code: 'EMAIL_SEND_ERROR'
          })
        }),
        'Error sending email for exemption EXE/2025/10003'
      )

      expect(mockDb.collection).toHaveBeenCalledWith('email-queue')
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        applicationReferenceNumber: 'EXE/2025/10003',
        status: 'error',
        errors: JSON.stringify(mockError.response.data.errors),
        reference: 'EXE/2025/10003'
      })
    })

    it('should handle network errors from Notify API', async () => {
      const mockError = {
        response: {
          data: {
            errors: [
              {
                error: 'NetworkError',
                message: 'Unable to connect to Notify service'
              }
            ]
          }
        }
      }

      mockNotifyClient.sendEmail.mockRejectedValue(mockError)

      const params = {
        db: mockDb,
        userName: 'Bob Wilson',
        userEmail: 'bob.wilson@example.com',
        applicationReference: 'EXE/2025/10004',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439014'
      }

      await sendUserEmailConfirmation(params)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Error sending email'),
            code: 'EMAIL_SEND_ERROR'
          })
        }),
        'Error sending email for exemption EXE/2025/10004'
      )
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        applicationReferenceNumber: 'EXE/2025/10004',
        status: 'error',
        errors: JSON.stringify(mockError.response.data.errors),
        reference: 'EXE/2025/10004'
      })
    })
  })

  describe('Database Operations', () => {
    it('should call correct database collection', async () => {
      const mockEmailResponse = {
        data: { id: 'test-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'Test User',
        userEmail: 'test@example.com',
        applicationReference: 'EXE/2025/10005',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439015'
      }

      await sendUserEmailConfirmation(params)

      expect(mockDb.collection).toHaveBeenCalledWith('email-queue')
      expect(mockDb.collection).toHaveBeenCalledTimes(1)
    })

    it('should insert correct data structure for successful emails', async () => {
      const mockEmailResponse = {
        data: { id: 'success-id-789' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'Alice Johnson',
        userEmail: 'alice.johnson@example.com',
        applicationReference: 'EXE/2025/10006',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439016'
      }

      await sendUserEmailConfirmation(params)

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        applicationReferenceNumber: 'EXE/2025/10006',
        status: 'success',
        id: 'success-id-789',
        reference: 'EXE/2025/10006'
      })
    })

    it('should insert correct data structure for failed emails', async () => {
      const mockError = {
        response: {
          data: {
            errors: [{ error: 'ValidationError', message: 'Invalid template' }]
          }
        }
      }

      mockNotifyClient.sendEmail.mockRejectedValue(mockError)

      const params = {
        db: mockDb,
        userName: 'Charlie Brown',
        userEmail: 'charlie.brown@example.com',
        applicationReference: 'EXE/2025/10007',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439017'
      }

      await sendUserEmailConfirmation(params)

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        applicationReferenceNumber: 'EXE/2025/10007',
        status: 'error',
        errors: JSON.stringify(mockError.response.data.errors),
        reference: 'EXE/2025/10007'
      })
    })
  })

  describe('Configuration and Initialization', () => {
    it('should use individual notify template ID when no organisation name provided', async () => {
      const mockEmailResponse = {
        data: { id: 'template-test-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'Template Test',
        userEmail: 'template@example.com',
        organisation: null,
        applicationReference: 'EXE/2025/10008',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439018'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        mockConfig.notifyTemplateId,
        'template@example.com',
        expect.objectContaining({
          personalisation: expect.objectContaining({
            name: 'Template Test'
          })
        })
      )
    })

    it('should use organisation notify template ID when organisation name provided', async () => {
      const mockEmailResponse = {
        data: { id: 'org-template-test-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'Org Template Test',
        userEmail: 'orgtemplate@example.com',
        organisation: {
          id: 'org-789',
          name: 'Test Org Ltd',
          userRelationshipType: 'Employee'
        },
        applicationReference: 'EXE/2025/10015',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439025'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        mockConfig.notifyTemplateIdEmployee,
        'orgtemplate@example.com',
        expect.objectContaining({
          personalisation: expect.objectContaining({
            name: 'Org Template Test',
            organisationName: 'Test Org Ltd'
          })
        })
      )
    })

    it('should construct view details URL correctly using frontEndBaseUrl and exemptionId', async () => {
      const mockEmailResponse = {
        data: { id: 'url-test-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'URL Test User',
        userEmail: 'url.test@example.com',
        applicationReference: 'EXE/2025/10013',
        frontEndBaseUrl:
          'https://test-environment.marine-licensing.defra.gov.uk',
        exemptionId: '64a1b2c3d4e5f6789abcdef0'
      }

      await sendUserEmailConfirmation(params)

      expect(
        mockNotifyClient.sendEmail.mock.calls[0][2].personalisation
          .viewDetailsUrl
      ).toEqual(
        'https://test-environment.marine-licensing.defra.gov.uk/exemption/view-details/64a1b2c3d4e5f6789abcdef0'
      )
    })

    it('should handle different frontEndBaseUrl formats', async () => {
      const mockEmailResponse = {
        data: { id: 'base-url-test-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'Base URL Test',
        userEmail: 'baseurl@example.com',
        organisation: null,
        applicationReference: 'EXE/2025/10014',
        frontEndBaseUrl: 'http://localhost:3000', // Different format for testing
        exemptionId: '64a1b2c3d4e5f6789abcdef1'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        mockConfig.notifyTemplateId,
        'baseurl@example.com',
        {
          personalisation: {
            name: 'Base URL Test',
            reference: 'EXE/2025/10014',
            viewDetailsUrl:
              'http://localhost:3000/exemption/view-details/64a1b2c3d4e5f6789abcdef1',
            organisationName: undefined
          },
          reference: 'EXE/2025/10014'
        }
      )
    })
  })

  describe('Input Validation and Edge Cases', () => {
    it('should handle empty userName', async () => {
      const mockEmailResponse = {
        data: { id: 'empty-name-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: '',
        userEmail: 'empty.name@example.com',
        organisation: null,
        applicationReference: 'EXE/2025/10009',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439019'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        mockConfig.notifyTemplateId,
        'empty.name@example.com',
        {
          personalisation: {
            name: '',
            reference: 'EXE/2025/10009',
            viewDetailsUrl:
              'https://marine-licensing.defra.gov.uk/exemption/view-details/507f1f77bcf86cd799439019',
            organisationName: undefined
          },
          reference: 'EXE/2025/10009'
        }
      )
    })

    it('should handle long reference numbers', async () => {
      const mockEmailResponse = {
        data: { id: 'long-ref-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const longReference = 'EXE/2025/99999'
      const params = {
        db: mockDb,
        userName: 'Long Reference User',
        userEmail: 'long.ref@example.com',
        organisation: null,
        applicationReference: longReference,
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439020'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        mockConfig.notifyTemplateId,
        'long.ref@example.com',
        {
          personalisation: {
            name: 'Long Reference User',
            reference: longReference,
            viewDetailsUrl:
              'https://marine-licensing.defra.gov.uk/exemption/view-details/507f1f77bcf86cd799439020',
            organisationName: undefined
          },
          reference: longReference
        }
      )
    })

    it('should handle emails with plus addressing', async () => {
      const mockEmailResponse = {
        data: { id: 'plus-email-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'Plus User',
        userEmail: 'user+test@example.com',
        organisation: null,
        applicationReference: 'EXE/2025/10010',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439021'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        mockConfig.notifyTemplateId,
        'user+test@example.com',
        expect.objectContaining({
          personalisation: expect.objectContaining({
            name: 'Plus User'
          })
        })
      )
    })
  })

  describe('Logging Behavior', () => {
    it('should log the correct information message', async () => {
      const mockEmailResponse = {
        data: { id: 'logging-test-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'Logging Test User',
        userEmail: 'logging@example.com',
        applicationReference: 'EXE/2025/10011',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439022'
      }

      await sendUserEmailConfirmation(params)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sent confirmation email for exemption EXE/2025/10011'
      )
      expect(mockLogger.info).toHaveBeenCalledTimes(1)
    })

    it('should log errors when email sending fails', async () => {
      const mockError = {
        response: {
          data: {
            errors: [{ error: 'TestError', message: 'Test error message' }]
          }
        }
      }

      mockNotifyClient.sendEmail.mockRejectedValue(mockError)

      const params = {
        db: mockDb,
        userName: 'Error Test',
        userEmail: 'error@example.com',
        applicationReference: 'EXE/2025/10012',
        frontEndBaseUrl: 'https://marine-licensing.defra.gov.uk',
        exemptionId: '507f1f77bcf86cd799439023'
      }

      await sendUserEmailConfirmation(params)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Error sending email'),
            code: 'EMAIL_SEND_ERROR'
          })
        }),
        'Error sending email for exemption EXE/2025/10012'
      )
      expect(mockLogger.error).toHaveBeenCalledTimes(1)
    })
  })
})
