import { vi } from 'vitest'
import { updatePublicNotice } from './update-public-notice.js'
import { mockMasRejectedSqsMessage } from './test-fixtures.js'
import { sendRejectedEmail } from './send-rejected-email.js'
import { randomUUID } from 'node:crypto'

vi.mock('./send-rejected-email.js', () => ({
  sendRejectedEmail: vi.fn()
}))

describe('updatePublicNotice', async () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })

  const mockLicenceId = randomUUID()
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

  const body = JSON.parse(mockMasRejectedSqsMessage.Body)

  it('should update marine licence with new status', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    await updatePublicNotice(server.db, server.logger, {
      body,
      id: mockMasRejectedSqsMessage.MessageId
    })

    expect(mockDb.collection).toHaveBeenCalledWith('marine-licences')
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      {
        applicationReference: body.applicationReference
      },
      {
        $set: {
          updatedAt: new Date(),
          updatedBy: mockMasRejectedSqsMessage.MessageId
        }
      },
      { returnDocument: 'after' }
    )
  })

  it.skip('should send correct email when a licence is matched', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    await updatePublicNotice(server.db, server.logger, {
      body,
      id: mockMasRejectedSqsMessage.MessageId
    })

    expect(sendRejectedEmail).toHaveBeenCalledWith({
      db: server.db,
      userName: body.userName,
      userEmail: body.userEmail,
      applicationReference: body.applicationReference,
      viewDetailsUrl: `http://localhost:3000/marine-licence/view-details/${mockLicenceId}`
    })
  })

  it('should correctly log when no results are found', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    mockFindOneAndUpdate.mockResolvedValueOnce(null)

    await updatePublicNotice(server.db, server.logger, {
      body,
      id: mockMasRejectedSqsMessage.MessageId
    })

    expect(server.logger.warn).toHaveBeenCalledWith(
      {
        event: {
          action: 'mas:job-stale',
          outcome: 'success'
        }
      },
      `No marine licence found for applicationReference ${body.applicationReference}`
    )
    expect(sendRejectedEmail).not.toHaveBeenCalled()
  })

  it('should log and rethrow when the database operation fails', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    const dbError = new Error('connection lost')
    mockFindOneAndUpdate.mockRejectedValueOnce(dbError)

    await expect(
      updatePublicNotice(server.db, server.logger, {
        body,
        id: mockMasRejectedSqsMessage.MessageId
      })
    ).rejects.toThrow(dbError)

    expect(server.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.anything() }),
      `Failed to update marine licence for applicationReference ${body.applicationReference}; the queue will retry`
    )
    expect(server.logger.warn).not.toHaveBeenCalled()
    expect(sendRejectedEmail).not.toHaveBeenCalled()
  })
})
