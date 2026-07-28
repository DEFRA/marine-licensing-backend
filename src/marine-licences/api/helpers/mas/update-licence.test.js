import { vi } from 'vitest'
import { updateTransferredMarineLicence } from './update-licence'
import { mockMasSqsMessage } from './test-fixtures.js'

describe('updateTransferredMarineLicence', async () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })

  const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
  const mockCollection = {
    updateOne: mockUpdateOne
  }

  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection)
  }

  const buildServer = () => ({
    db: mockDb,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  const body = JSON.parse(mockMasSqsMessage.Body)

  it('should update marine licence with new status', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    await updateTransferredMarineLicence(server.db, server.logger, {
      body,
      id: mockMasSqsMessage.MessageId
    })

    expect(mockDb.collection).toHaveBeenCalledWith('marine-licences')
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { applicationReference: body.applicationReference },
      {
        $set: {
          status: 'transferred',
          transferredDate: body.transferredDate,
          updatedAt: new Date(),
          updatedBy: mockMasSqsMessage.MessageId
        }
      }
    )
  })

  it('should correctly log when no results are found', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    mockUpdateOne.mockResolvedValueOnce({ matchedCount: 0 })

    await updateTransferredMarineLicence(server.db, server.logger, {
      body,
      id: mockMasSqsMessage.MessageId
    })

    expect(server.logger.warn).toHaveBeenCalledWith(
      {
        event: {
          action: 'mas:job-stale',
          outcome: 'success',
          reference: body.applicationReference
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
    mockUpdateOne.mockRejectedValueOnce(dbError)

    await expect(
      updateTransferredMarineLicence(server.db, server.logger, {
        body,
        id: mockMasSqsMessage.MessageId
      })
    ).rejects.toThrow(dbError)

    expect(server.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.anything() }),
      `Failed to update marine licence for applicationReference ${body.applicationReference}; the queue will retry`
    )
    expect(server.logger.warn).not.toHaveBeenCalled()
  })
})
