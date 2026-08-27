import { vi } from 'vitest'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import { getSnsClient, resetSnsClient, publishMessage } from './sns-client.js'

const topicArn =
  'arn:aws:sns:eu-west-2:000000000000:marine_licensing_public_register'

const findCommand = (mockSend, CommandType) =>
  mockSend.mock.calls.map((c) => c[0]).find((c) => c instanceof CommandType)

describe('sns-client', () => {
  let mockSend

  beforeEach(() => {
    resetSnsClient()
    mockSend = vi
      .spyOn(SNSClient.prototype, 'send')
      .mockResolvedValue({ MessageId: 'msg-1' })
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
  })

  describe('publishMessage', () => {
    it('sends a PublishCommand with the provided topic ARN', async () => {
      const body = JSON.stringify({ applicationType: 'exemption' })
      const attributes = {
        applicationType: { DataType: 'String', StringValue: 'exemption' }
      }

      await publishMessage(topicArn, body, attributes)

      const cmd = findCommand(mockSend, PublishCommand)
      expect(cmd.input).toEqual({
        TopicArn: topicArn,
        Message: body,
        MessageAttributes: attributes
      })
    })

    it('omits MessageAttributes when not provided', async () => {
      await publishMessage(topicArn, 'plain')

      const cmd = findCommand(mockSend, PublishCommand)
      expect(cmd.input).toEqual({
        TopicArn: topicArn,
        Message: 'plain'
      })
    })
  })
})
