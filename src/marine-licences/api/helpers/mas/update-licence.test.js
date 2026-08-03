import { vi } from 'vitest'
import { updateTransferredMarineLicence } from './update-licence'
import { mockMasSqsMessage } from './test-fixtures.js'
import { MARINE_LICENCE_STATUS } from '../../../constants/marine-licence.js'
import { sendTransferredEmail } from './send-transferred-email.js'

vi.mock('./send-transferred-email.js', () => ({
  sendTransferredEmail: vi.fn()
}))

describe('updateTransferredMarineLicence', async () => {
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
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      {
        applicationReference: body.applicationReference,
        status: { $ne: MARINE_LICENCE_STATUS.TRANSFERRED }
      },
      {
        $set: {
          status: MARINE_LICENCE_STATUS.TRANSFERRED,
          transferredDate: body.transferredDate,
          updatedAt: new Date(),
          updatedBy: mockMasSqsMessage.MessageId
        }
      },
      { returnDocument: 'after' }
    )
  })

  it('should send transferred email when a licence is matched', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    await updateTransferredMarineLicence(server.db, server.logger, {
      body,
      id: mockMasSqsMessage.MessageId
    })

    expect(sendTransferredEmail).toHaveBeenCalledWith({
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
      `No marine licence found, or it is already transferred, for applicationReference ${body.applicationReference}`
    )
    expect(sendTransferredEmail).not.toHaveBeenCalled()
  })

  it('should not update or send an email again for a duplicate message when the licence is already transferred', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    mockFindOneAndUpdate.mockResolvedValueOnce(null)

    await updateTransferredMarineLicence(server.db, server.logger, {
      body,
      id: mockMasSqsMessage.MessageId
    })

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      {
        applicationReference: body.applicationReference,
        status: { $ne: MARINE_LICENCE_STATUS.TRANSFERRED }
      },
      expect.anything(),
      expect.anything()
    )
    expect(sendTransferredEmail).not.toHaveBeenCalled()
  })

  it('should log and rethrow when the database operation fails', async () => {
    const { mockMongo } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(mockDb.collection)
    const server = buildServer()

    const dbError = new Error('connection lost')
    mockFindOneAndUpdate.mockRejectedValueOnce(dbError)

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
    expect(sendTransferredEmail).not.toHaveBeenCalled()
  })
})
