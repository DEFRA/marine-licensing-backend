import { vi } from 'vitest'
import { processMasMessage, processMasDlqMessage } from './worker-processor.js'
import { deleteMasMessage } from './sqs-client.js'
import {
  mockMalformedMasSqsMessage,
  mockMasInvalidApplicationReferenceSqsMessage,
  mockMasMissingApplicationReferenceSqsMessage,
  mockMasSqsMessage
} from './test-fixtures.js'
import { updateTransferredMarineLicence } from './update-transferred-licence.js'
import { MAS_EVENT_ACTION } from '../../../constants/marine-licence.js'

vi.mock('./sqs-client.js', () => ({
  deleteMasMessage: vi.fn()
}))

vi.mock('./update-transferred-licence.js')

const sqsQueueName = 'marine_licensing_mas'
const sqsDlqName = 'marine_licensing_mas-deadletter'

describe('mas-worker-processor', () => {
  const buildServer = () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  describe('processMasMessage', () => {
    it('should log and delete a well-formed message', async () => {
      const server = buildServer()
      const body = JSON.parse(mockMasSqsMessage.Body)

      await processMasMessage(server, mockMasSqsMessage)

      expect(server.logger.info).toHaveBeenCalledWith(
        {
          event: {
            action: MAS_EVENT_ACTION.MESSAGE_RECEIVED,
            outcome: 'success',
            reference: body.applicationReference
          }
        },
        `Received MAS message for ${body.applicationReference}`
      )
      expect(updateTransferredMarineLicence).toHaveBeenCalledWith(
        server.db,
        server.logger,
        { body, id: mockMasSqsMessage.MessageId }
      )
      expect(deleteMasMessage).toHaveBeenCalledWith(
        sqsQueueName,
        mockMasSqsMessage.ReceiptHandle
      )
    })

    it('should log an error and still delete a malformed message', async () => {
      const server = buildServer()

      await processMasMessage(server, mockMalformedMasSqsMessage)

      expect(server.logger.error).toHaveBeenCalled()
      expect(server.logger.info).not.toHaveBeenCalled()
      expect(deleteMasMessage).toHaveBeenCalledWith(
        sqsQueueName,
        mockMalformedMasSqsMessage.ReceiptHandle
      )
    })

    it('should throw when the message has no application reference', async () => {
      const server = buildServer()

      await expect(
        processMasMessage(server, mockMasMissingApplicationReferenceSqsMessage)
      ).rejects.toThrow('No Application Reference exists on message')

      expect(updateTransferredMarineLicence).not.toHaveBeenCalled()
      expect(deleteMasMessage).not.toHaveBeenCalled()
    })

    it('should throw when the application reference is not a non-empty string', async () => {
      const server = buildServer()

      await expect(
        processMasMessage(server, mockMasInvalidApplicationReferenceSqsMessage)
      ).rejects.toThrow('No Application Reference exists on message')

      expect(updateTransferredMarineLicence).not.toHaveBeenCalled()
      expect(deleteMasMessage).not.toHaveBeenCalled()
    })
  })

  describe('processMasDlqMessage', () => {
    it('should warn and delete a well-formed dead-lettered message', async () => {
      const server = buildServer()

      await processMasDlqMessage(server, mockMasSqsMessage)

      const body = JSON.parse(mockMasSqsMessage.Body)
      expect(server.logger.warn).toHaveBeenCalledWith(
        {
          event: {
            action: MAS_EVENT_ACTION.MESSAGE_DEAD_LETTERED,
            outcome: 'failure',
            reference: body.applicationReference
          }
        },
        `MAS message dead-lettered for ${body.applicationReference}`
      )
      expect(deleteMasMessage).toHaveBeenCalledWith(
        sqsDlqName,
        mockMasSqsMessage.ReceiptHandle
      )
    })

    it('should log an error and still delete a malformed dead-lettered message', async () => {
      const server = buildServer()

      await processMasDlqMessage(server, mockMalformedMasSqsMessage)

      expect(server.logger.error).toHaveBeenCalled()
      expect(server.logger.warn).not.toHaveBeenCalled()
      expect(deleteMasMessage).toHaveBeenCalledWith(
        sqsDlqName,
        mockMalformedMasSqsMessage.ReceiptHandle
      )
    })
  })
})
