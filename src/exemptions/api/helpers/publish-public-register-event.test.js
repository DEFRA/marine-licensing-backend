import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  buildPublicRegisterSubmittedPayload,
  buildPublicRegisterWithdrawnPayload,
  publishPublicRegisterEvent,
  publishPublicRegisterSubmittedEvent,
  publishPublicRegisterWithdrawnEvent,
  PUBLIC_REGISTER_APPLICATION_TYPE,
  PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED,
  PUBLIC_REGISTER_EVENT_TYPE_WITHDRAWN
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

describe('publish public register events', () => {
  let logger

  beforeEach(() => {
    vi.clearAllMocks()
    config.get.mockReturnValue(topicArn)
    logger = { info: vi.fn(), error: vi.fn() }
    publishMessage.mockResolvedValue({ MessageId: 'msg-1' })
  })

  describe('buildPublicRegisterSubmittedPayload', () => {
    it('builds the submitted list payload', () => {
      const submittedAt = new Date('2026-03-18T10:00:00.000Z')

      expect(
        buildPublicRegisterSubmittedPayload({
          applicationId: '64f1abc',
          applicationReference: 'EXE/2026/00012',
          projectName: 'South coast sea samples',
          marinePlanAreas: ['South'],
          submittedAt
        })
      ).toEqual({
        applicationType: PUBLIC_REGISTER_APPLICATION_TYPE,
        eventType: PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED,
        applicationId: '64f1abc',
        applicationReference: 'EXE/2026/00012',
        projectName: 'South coast sea samples',
        marinePlanAreas: ['South'],
        dateSubmitted: submittedAt.toISOString(),
        status: 'Active'
      })
    })
  })

  describe('buildPublicRegisterWithdrawnPayload', () => {
    it('builds the withdrawn list payload', () => {
      expect(
        buildPublicRegisterWithdrawnPayload({
          applicationId: '64f1abc',
          applicationReference: 'EXE/2026/00012',
          projectName: 'South coast sea samples',
          marinePlanAreas: ['South'],
          submittedAt: '2026-03-18T10:00:00.000Z'
        })
      ).toEqual({
        applicationType: PUBLIC_REGISTER_APPLICATION_TYPE,
        eventType: PUBLIC_REGISTER_EVENT_TYPE_WITHDRAWN,
        applicationId: '64f1abc',
        applicationReference: 'EXE/2026/00012',
        projectName: 'South coast sea samples',
        marinePlanAreas: ['South'],
        dateSubmitted: '2026-03-18T10:00:00.000Z',
        status: 'Withdrawn'
      })
    })
  })

  describe('publishPublicRegisterSubmittedEvent', () => {
    it('publishes the expanded payload with SNS message attributes', async () => {
      const submittedAt = new Date('2026-03-18T10:00:00.000Z')

      await publishPublicRegisterSubmittedEvent({
        applicationId: '64f1abc',
        applicationReference: 'EXE/2026/00012',
        projectName: 'South coast sea samples',
        marinePlanAreas: ['South'],
        submittedAt,
        logger
      })

      expect(config.get).toHaveBeenCalledWith('publicRegister.snsTopicArn')
      expect(publishMessage).toHaveBeenCalledWith(
        topicArn,
        JSON.stringify({
          applicationType: PUBLIC_REGISTER_APPLICATION_TYPE,
          eventType: PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED,
          applicationId: '64f1abc',
          applicationReference: 'EXE/2026/00012',
          projectName: 'South coast sea samples',
          marinePlanAreas: ['South'],
          dateSubmitted: submittedAt.toISOString(),
          status: 'Active'
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
          topicArn,
          applicationId: '64f1abc',
          applicationReference: 'EXE/2026/00012',
          eventType: PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED
        },
        'Published public register event to SNS'
      )
    })
  })

  describe('publishPublicRegisterWithdrawnEvent', () => {
    it('publishes the withdrawn payload', async () => {
      await publishPublicRegisterWithdrawnEvent({
        applicationId: '64f1abc',
        applicationReference: 'EXE/2026/00012',
        projectName: 'South coast sea samples',
        marinePlanAreas: ['South'],
        submittedAt: '2026-03-18T10:00:00.000Z',
        logger
      })

      expect(publishMessage).toHaveBeenCalledWith(
        topicArn,
        JSON.stringify({
          applicationType: PUBLIC_REGISTER_APPLICATION_TYPE,
          eventType: PUBLIC_REGISTER_EVENT_TYPE_WITHDRAWN,
          applicationId: '64f1abc',
          applicationReference: 'EXE/2026/00012',
          projectName: 'South coast sea samples',
          marinePlanAreas: ['South'],
          dateSubmitted: '2026-03-18T10:00:00.000Z',
          status: 'Withdrawn'
        }),
        expect.any(Object)
      )
    })
  })

  describe('publishPublicRegisterEvent', () => {
    it('logs and does not throw when SNS publish fails', async () => {
      publishMessage.mockRejectedValueOnce(new Error('SNS unavailable'))

      await expect(
        publishPublicRegisterEvent({
          applicationType: PUBLIC_REGISTER_APPLICATION_TYPE,
          eventType: PUBLIC_REGISTER_EVENT_TYPE_SUBMITTED,
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
})
