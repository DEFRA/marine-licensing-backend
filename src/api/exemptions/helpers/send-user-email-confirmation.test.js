import { sendUserEmailConfirmation } from './send-user-email-confirmation.js'
import { config } from '../../../config.js'
import { NotifyClient } from 'notifications-node-client'
import { createLogger } from '../../../common/helpers/logging/logger.js'

jest.mock('../../../config.js')
jest.mock('notifications-node-client')
jest.mock('../../../common/helpers/logging/logger.js')

describe('sendUserEmailConfirmation', () => {
  let mockDb
  let mockCollection
  let mockNotifyClient
  let mockLogger
  let mockConfig

  beforeEach(() => {
    jest.clearAllMocks()

    mockCollection = {
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock-id' })
    }

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    }

    mockNotifyClient = {
      sendEmail: jest.fn()
    }

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    }

    mockConfig = {
      apiKey: 'test-api-key',
      retryIntervalMs: 1,
      retries: 1
    }

    config.get.mockReturnValue(mockConfig)
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
        applicationReference: 'EXE/2025/10001'
      }

      await sendUserEmailConfirmation(params)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sent confirmation email for exemption EXE/2025/10001'
      )

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        'a9f8607a-1a1b-4c49-87c0-b260824d2e12',
        'john.doe@example.com',
        {
          personalisation: {
            name: 'John Doe',
            reference: 'EXE/2025/10001'
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
        applicationReference: 'EXE/2025/10002'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        'a9f8607a-1a1b-4c49-87c0-b260824d2e12',
        'jose.garcia@example.com',
        expect.objectContaining({
          personalisation: {
            name: 'José María García-López',
            reference: 'EXE/2025/10002'
          }
        })
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
        applicationReference: 'EXE/2025/10003'
      }

      await sendUserEmailConfirmation(params)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending email for exemption EXE/2025/10003: [{"error":"BadRequestError","message":"Invalid email address"}]'
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
        applicationReference: 'EXE/2025/10004'
      }

      await sendUserEmailConfirmation(params)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending email for exemption EXE/2025/10004: [{"error":"NetworkError","message":"Unable to connect to Notify service"}]'
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
        applicationReference: 'EXE/2025/10005'
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
        applicationReference: 'EXE/2025/10006'
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
        applicationReference: 'EXE/2025/10007'
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
    it('should use correct notify template ID', async () => {
      const mockEmailResponse = {
        data: { id: 'template-test-id' }
      }

      mockNotifyClient.sendEmail.mockResolvedValue(mockEmailResponse)

      const params = {
        db: mockDb,
        userName: 'Template Test',
        userEmail: 'template@example.com',
        applicationReference: 'EXE/2025/10008'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        'a9f8607a-1a1b-4c49-87c0-b260824d2e12',
        'template@example.com',
        expect.any(Object)
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
        applicationReference: 'EXE/2025/10009'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        'a9f8607a-1a1b-4c49-87c0-b260824d2e12',
        'empty.name@example.com',
        expect.objectContaining({
          personalisation: {
            name: '',
            reference: 'EXE/2025/10009'
          }
        })
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
        applicationReference: longReference
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        'a9f8607a-1a1b-4c49-87c0-b260824d2e12',
        'long.ref@example.com',
        expect.objectContaining({
          personalisation: {
            name: 'Long Reference User',
            reference: longReference
          },
          reference: longReference
        })
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
        applicationReference: 'EXE/2025/10010'
      }

      await sendUserEmailConfirmation(params)

      expect(mockNotifyClient.sendEmail).toHaveBeenCalledWith(
        'a9f8607a-1a1b-4c49-87c0-b260824d2e12',
        'user+test@example.com',
        expect.any(Object)
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
        applicationReference: 'EXE/2025/10011'
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
        applicationReference: 'EXE/2025/10012'
      }

      await sendUserEmailConfirmation(params)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending email for exemption EXE/2025/10012: [{"error":"TestError","message":"Test error message"}]'
      )
      expect(mockLogger.error).toHaveBeenCalledTimes(1)
    })
  })
})
