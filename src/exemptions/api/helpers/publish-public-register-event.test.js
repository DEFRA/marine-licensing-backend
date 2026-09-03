import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  publishPublicRegisterSubmittedEvent,
  PUBLIC_REGISTER_APPLICATION_TYPE,
  PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED
} from './publish-public-register-event.js'
import { publishMessage } from '../../../shared/common/helpers/sns/sns-client.js'
import { config } from '../../../config.js'

vi.mock('../../../shared/common/helpers/sns/sns-client.js', () => ({
  publishMessage: vi.fn()
}))

vi.mock('../../../config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

const topicArn =
  'arn:aws:sns:eu-west-2:000000000000:marine_licensing_public_register'

describe('publishPublicRegisterSubmittedEvent', () => {
  let logger

  beforeEach(() => {
    config.get.mockReturnValue(topicArn)
    logger = { info: vi.fn(), error: vi.fn() }
    publishMessage.mockResolvedValue({ MessageId: 'msg-1' })
  })

  it('publishes the simple payload with SNS message attributes', async () => {
    await publishPublicRegisterSubmittedEvent({
      applicationId: '64f1abc',
      applicationReference: 'EXE/2026/00012',
      logger
    })

    expect(config.get).toHaveBeenCalledWith('publicRegister.snsTopicArn')
    expect(publishMessage).toHaveBeenCalledWith(
      topicArn,
      JSON.stringify({
        applicationType: PUBLIC_REGISTER_APPLICATION_TYPE,
        eventType: PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED,
        applicationId: '64f1abc',
        applicationReference: 'EXE/2026/00012'
      }),
      {
        applicationType: {
          DataType: 'String',
          StringValue: PUBLIC_REGISTER_APPLICATION_TYPE
        },
        eventType: {
          DataType: 'String',
          StringValue: PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED
        }
      }
    )
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: {
          action: 'public-register-publish',
          outcome: 'success',
          reference: '64f1abc'
        }
      },
      'Published public register submitted event for EXE/2026/00012'
    )
  })

  it('logs and does not throw when SNS publish fails', async () => {
    publishMessage.mockRejectedValueOnce(new Error('SNS unavailable'))

    await expect(
      publishPublicRegisterSubmittedEvent({
        applicationId: '64f1abc',
        applicationReference: 'EXE/2026/00012',
        logger
      })
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'SNS unavailable' })
      }),
      'Failed to publish public register event for EXE/2026/00012'
    )
  })
})
