import { vi } from 'vitest'
import {
  SNSClient,
  CreateTopicCommand,
  PublishCommand
} from '@aws-sdk/client-sns'
import { getSnsClient, resetSnsClient, publishMessage } from './sns-client.js'

const topicName = 'marine_licensing_public_register'
const topicArn = `arn:aws:sns:eu-west-2:000000000000:${topicName}`

const findCommand = (mockSend, CommandType) =>
  mockSend.mock.calls.map((c) => c[0]).find((c) => c instanceof CommandType)

describe('sns-client', () => {
  let mockSend

  beforeEach(() => {
    resetSnsClient()
    mockSend = vi
      .spyOn(SNSClient.prototype, 'send')
      .mockImplementation((command) => {
        if (command instanceof CreateTopicCommand) {
          return Promise.resolve({ TopicArn: topicArn })
        }
        return Promise.resolve({ MessageId: 'msg-1' })
      })
  })

  describe('getSnsClient', () => {
    it('returns the same instance on repeated calls', () => {
      const a = getSnsClient()
      const b = getSnsClient()
      expect(a).toBe(b)
    })
  })

  describe('resetSnsClient', () => {
    it('clears the singleton so a new client is created on next call', () => {
      const a = getSnsClient()
      resetSnsClient()
      const b = getSnsClient()
      expect(a).not.toBe(b)
    })

    it('clears the ARN cache so the topic ARN is re-fetched', async () => {
      await publishMessage(topicName, '{}')
      const createCallsAfterFirst = mockSend.mock.calls.filter(
        (c) => c[0] instanceof CreateTopicCommand
      ).length
      expect(createCallsAfterFirst).toBe(1)

      resetSnsClient()
      await publishMessage(topicName, '{}')

      const createCallsAfterReset = mockSend.mock.calls.filter(
        (c) => c[0] instanceof CreateTopicCommand
      ).length
      expect(createCallsAfterReset).toBe(2)
    })
  })

  describe('publishMessage', () => {
    it('resolves the topic ARN and sends a PublishCommand', async () => {
      const body = JSON.stringify({ applicationType: 'exemption' })
      const attributes = {
        applicationType: { DataType: 'String', StringValue: 'exemption' }
      }

      await publishMessage(topicName, body, attributes)

      const cmd = findCommand(mockSend, PublishCommand)
      expect(cmd.input).toEqual({
        TopicArn: topicArn,
        Message: body,
        MessageAttributes: attributes
      })
    })

    it('uses the cached ARN on a second call, skipping CreateTopicCommand', async () => {
      await publishMessage(topicName, 'first')
      await publishMessage(topicName, 'second')

      const createCalls = mockSend.mock.calls.filter(
        (c) => c[0] instanceof CreateTopicCommand
      )
      expect(createCalls).toHaveLength(1)
    })

    it('omits MessageAttributes when not provided', async () => {
      await publishMessage(topicName, 'plain')

      const cmd = findCommand(mockSend, PublishCommand)
      expect(cmd.input).toEqual({
        TopicArn: topicArn,
        Message: 'plain'
      })
    })
  })
})
