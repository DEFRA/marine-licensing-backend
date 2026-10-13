import { vi } from 'vitest'
import {
  mockMasConsultationRequestMessageBody,
  mockMasConsultationRequestSqsMessage
} from './test-fixtures.js'
import { addConsultationRequest } from './add-consultation-request.js'

describe('addConsultationRequest', async () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.clearAllMocks()
  })

  const mockLicenceId = '507f1f77bcf86cd799439011'
  const mockFindOneAndUpdate = vi.fn().mockResolvedValue({ _id: mockLicenceId })
  const mockCollection = {
    findOneAndUpdate: mockFindOneAndUpdate
  }

  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection)
  }

  const buildServer = () => ({
    db: mockDb,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  const body = JSON.parse(mockMasConsultationRequestSqsMessage.Body)

  it('should update marine licence with new consultee request', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    await addConsultationRequest(server.db, server.logger, {
      body,
      id: mockMasConsultationRequestSqsMessage.MessageId
    })

    expect(mockDb.collection).toHaveBeenCalledWith('marine-licences')
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      {
        applicationReference: body.applicationReference
      },
      {
        $addToSet: {
          consultationRequests: {
            consultationStartDate:
              mockMasConsultationRequestMessageBody.consultationStartDate,
            consultees: mockMasConsultationRequestMessageBody.consultees
          }
        },
        $set: {
          updatedAt: new Date(),
          updatedBy: mockMasConsultationRequestSqsMessage.MessageId
        }
      },
      { returnDocument: 'after' }
    )
  })

  it('should correctly log when no results are found', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    mockFindOneAndUpdate.mockResolvedValueOnce(null)

    await addConsultationRequest(server.db, server.logger, {
      body,
      id: mockMasConsultationRequestSqsMessage.MessageId
    })

    expect(server.logger.warn).toHaveBeenCalledWith(
      {
        event: {
          action: 'mas:job-stale',
          outcome: 'success',
          reference: mockMasConsultationRequestMessageBody.applicationReference
        }
      },
      `No marine licence found for applicationReference ${body.applicationReference}`
    )
  })

  it('should log and rethrow when the database operation fails', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    const dbError = new Error('connection lost')
    mockFindOneAndUpdate.mockRejectedValueOnce(dbError)

    await expect(
      addConsultationRequest(server.db, server.logger, {
        body,
        id: mockMasConsultationRequestSqsMessage.MessageId
      })
    ).rejects.toThrow(dbError)

    expect(server.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.anything() }),
      `Failed to add consultation request for applicationReference ${body.applicationReference}; the queue will retry`
    )
    expect(server.logger.warn).not.toHaveBeenCalled()
  })
})
