import { vi } from 'vitest'
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand
} from '@aws-sdk/client-sqs'
import {
  sendPolicyJob,
  receivePolicyJobs,
  receiveDlqJobs,
  deletePolicyJob,
  extendVisibility,
  resetSqsClient
} from './policies-sqs-client.js'

const queueUrl =
  'http://localhost:4566/000000000000/marine_licensing_policies.fifo'
const dlqUrl =
  'http://localhost:4566/000000000000/marine_licensing_policies-deadletter.fifo'

describe('policies-sqs-client', () => {
  let mockSend

  beforeEach(() => {
    resetSqsClient()
    mockSend = vi.spyOn(SQSClient.prototype, 'send').mockResolvedValue({})
  })

  it('should send a policy job as a FIFO message grouped by licence and deduped by job id', async () => {
    const queuedAt = new Date('2026-06-11T10:00:00.000Z')
    await sendPolicyJob({
      licenceId: 'licence-1',
      policyJobId: 'hash-1',
      queuedAt
    })

    const command = mockSend.mock.calls[0][0]
    expect(command).toBeInstanceOf(SendMessageCommand)
    expect(command.input).toEqual({
      QueueUrl: queueUrl,
      MessageGroupId: 'licence-1',
      MessageDeduplicationId: 'hash-1',
      MessageBody: JSON.stringify({
        licenceId: 'licence-1',
        policyJobId: 'hash-1',
        queuedAt
      })
    })
  })

  it('should long-poll the main queue and return messages', async () => {
    const messages = [{ MessageId: '1' }]
    mockSend.mockResolvedValueOnce({ Messages: messages })

    const received = await receivePolicyJobs()

    const command = mockSend.mock.calls[0][0]
    expect(command).toBeInstanceOf(ReceiveMessageCommand)
    expect(command.input).toEqual({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20
    })
    expect(received).toEqual(messages)
  })

  it('should return an empty array when the queue has no messages', async () => {
    mockSend.mockResolvedValueOnce({})
    expect(await receivePolicyJobs()).toEqual([])
  })

  it('should long-poll the dead-letter queue', async () => {
    mockSend.mockResolvedValueOnce({})

    await receiveDlqJobs()

    expect(mockSend.mock.calls[0][0].input.QueueUrl).toBe(dlqUrl)
  })

  it('should delete a message from the given queue', async () => {
    await deletePolicyJob(queueUrl, 'receipt-1')

    const command = mockSend.mock.calls[0][0]
    expect(command).toBeInstanceOf(DeleteMessageCommand)
    expect(command.input).toEqual({
      QueueUrl: queueUrl,
      ReceiptHandle: 'receipt-1'
    })
  })

  it('should extend message visibility on the main queue', async () => {
    await extendVisibility('receipt-1', 300)

    const command = mockSend.mock.calls[0][0]
    expect(command).toBeInstanceOf(ChangeMessageVisibilityCommand)
    expect(command.input).toEqual({
      QueueUrl: queueUrl,
      ReceiptHandle: 'receipt-1',
      VisibilityTimeout: 300
    })
  })
})
