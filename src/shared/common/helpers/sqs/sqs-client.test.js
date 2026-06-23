import { vi } from 'vitest'
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand
} from '@aws-sdk/client-sqs'
import {
  getSqsClient,
  resetSqsClient,
  sendMessage,
  receiveMessages,
  deleteMessage
} from './sqs-client.js'

const queueName = 'test-queue'
const queueUrl = 'http://localhost:4566/000000000000/test-queue'

const findCommand = (mockSend, CommandType) =>
  mockSend.mock.calls.map((c) => c[0]).find((c) => c instanceof CommandType)

describe('sqs-client', () => {
  let mockSend

  beforeEach(() => {
    resetSqsClient()
    mockSend = vi
      .spyOn(SQSClient.prototype, 'send')
      .mockImplementation((command) => {
        if (command instanceof GetQueueUrlCommand) {
          return Promise.resolve({ QueueUrl: queueUrl })
        }
        return Promise.resolve({ Messages: undefined })
      })
  })

  describe('getSqsClient', () => {
    it('returns the same instance on repeated calls', () => {
      const a = getSqsClient()
      const b = getSqsClient()
      expect(a).toBe(b)
    })
  })

  describe('resetSqsClient', () => {
    it('clears the singleton so a new client is created on next call', () => {
      const a = getSqsClient()
      resetSqsClient()
      const b = getSqsClient()
      expect(a).not.toBe(b)
    })

    it('clears the URL cache so the queue URL is re-fetched', async () => {
      await sendMessage(queueName, 'body')
      const urlCallsAfterFirst = mockSend.mock.calls.filter(
        (c) => c[0] instanceof GetQueueUrlCommand
      ).length
      expect(urlCallsAfterFirst).toBe(1)

      resetSqsClient()
      await sendMessage(queueName, 'body')

      const urlCallsAfterReset = mockSend.mock.calls.filter(
        (c) => c[0] instanceof GetQueueUrlCommand
      ).length
      expect(urlCallsAfterReset).toBe(2)
    })
  })

  describe('sendMessage', () => {
    it('resolves the queue URL and sends a SendMessageCommand', async () => {
      await sendMessage(queueName, '{"foo":"bar"}')

      const cmd = findCommand(mockSend, SendMessageCommand)
      expect(cmd.input).toEqual({
        QueueUrl: queueUrl,
        MessageBody: '{"foo":"bar"}'
      })
    })

    it('uses the cached URL on a second call, skipping GetQueueUrlCommand', async () => {
      await sendMessage(queueName, 'first')
      await sendMessage(queueName, 'second')

      const urlCalls = mockSend.mock.calls.filter(
        (c) => c[0] instanceof GetQueueUrlCommand
      )
      expect(urlCalls).toHaveLength(1)
    })
  })

  describe('receiveMessages', () => {
    it('issues a ReceiveMessageCommand with the resolved URL and merged options', async () => {
      mockSend.mockResolvedValueOnce({ QueueUrl: queueUrl })
      mockSend.mockResolvedValueOnce({ Messages: [{ MessageId: '1' }] })

      const options = {
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        AttributeNames: ['ApproximateReceiveCount']
      }
      const result = await receiveMessages(queueName, options)

      const cmd = findCommand(mockSend, ReceiveMessageCommand)
      expect(cmd.input).toEqual({ QueueUrl: queueUrl, ...options })
      expect(result).toEqual([{ MessageId: '1' }])
    })

    it('returns an empty array when Messages is undefined', async () => {
      const result = await receiveMessages(queueName)
      expect(result).toEqual([])
    })

    it('works without options, sending only QueueUrl', async () => {
      await receiveMessages(queueName)

      const cmd = findCommand(mockSend, ReceiveMessageCommand)
      expect(cmd.input).toEqual({ QueueUrl: queueUrl })
    })
  })

  describe('deleteMessage', () => {
    it('issues a DeleteMessageCommand with the resolved URL and receipt handle', async () => {
      await deleteMessage(queueName, 'receipt-abc')

      const cmd = findCommand(mockSend, DeleteMessageCommand)
      expect(cmd.input).toEqual({
        QueueUrl: queueUrl,
        ReceiptHandle: 'receipt-abc'
      })
    })
  })
})
