import { vi } from 'vitest'
import { processMasMessage, processMasDlqMessage } from './worker-processor.js'
import { deleteMasMessage } from './sqs-client.js'

vi.mock('./sqs-client.js', () => ({
  deleteMasMessage: vi.fn()
}))

const sqsQueueName = 'marine_licensing_mas'
const sqsDlqName = 'marine_licensing_mas-deadletter'

describe('mas-worker-processor', () => {
  const receiptHandle = 'receipt-1'

  const buildMessage = (body) => ({
    Body: typeof body === 'string' ? body : JSON.stringify(body),
    ReceiptHandle: receiptHandle
  })

  const buildServer = () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  describe('processMasMessage', () => {
    it('should log and delete a well-formed message', async () => {
      const server = buildServer()
      const body = { event: 'licence-updated' }

      await processMasMessage(server, buildMessage(body))

      expect(server.logger.info).toHaveBeenCalledWith(
        { body },
        'Received MAS message'
      )
      expect(deleteMasMessage).toHaveBeenCalledWith(sqsQueueName, receiptHandle)
    })

    it('should log an error and still delete a malformed message', async () => {
      const server = buildServer()

      await processMasMessage(server, buildMessage('not json'))

      expect(server.logger.error).toHaveBeenCalled()
      expect(server.logger.info).not.toHaveBeenCalled()
      expect(deleteMasMessage).toHaveBeenCalledWith(sqsQueueName, receiptHandle)
    })
  })

  describe('processMasDlqMessage', () => {
    it('should warn and delete a well-formed dead-lettered message', async () => {
      const server = buildServer()
      const body = { event: 'licence-updated' }

      await processMasDlqMessage(server, buildMessage(body))

      expect(server.logger.warn).toHaveBeenCalledWith(
        { body },
        'MAS message dead-lettered'
      )
      expect(deleteMasMessage).toHaveBeenCalledWith(sqsDlqName, receiptHandle)
    })

    it('should log an error and still delete a malformed dead-lettered message', async () => {
      const server = buildServer()

      await processMasDlqMessage(server, buildMessage('not json'))

      expect(server.logger.error).toHaveBeenCalled()
      expect(server.logger.warn).not.toHaveBeenCalled()
      expect(deleteMasMessage).toHaveBeenCalledWith(sqsDlqName, receiptHandle)
    })
  })
})
