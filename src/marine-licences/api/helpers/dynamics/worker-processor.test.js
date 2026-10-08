import { vi } from 'vitest'
import {
  processDynamicsJob,
  processDynamicsDlqJob
} from './worker-processor.js'
import { deleteDynamicsJob } from './sqs-client.js'
import { sendToDynamics } from '../../../../shared/common/helpers/dynamics/dynamics-client.js'
import { getDynamicsAccessToken } from '../../../../shared/common/helpers/dynamics/get-access-token.js'
import {
  DYNAMICS_QUEUE_TYPES,
  DYNAMICS_REQUEST_ACTIONS
} from '../../../../shared/common/constants/request-queue.js'
import { MARINE_LICENCE_DYNAMICS_EVENT_ACTION } from '../../../constants/marine-licence.js'

vi.mock('./sqs-client.js', () => ({
  deleteDynamicsJob: vi.fn()
}))
vi.mock(
  '../../../../shared/common/helpers/dynamics/dynamics-client.js',
  () => ({
    sendToDynamics: vi.fn()
  })
)
vi.mock(
  '../../../../shared/common/helpers/dynamics/get-access-token.js',
  () => ({
    getDynamicsAccessToken: vi.fn()
  })
)

const queueName = 'marine_licensing_d365_marine_licence'
const dlqName = 'marine_licensing_d365_marine_licence-deadletter'
const applicationReference = 'MLA/2026/00001'
const receiptHandle = 'receipt-1'
const { SUBMIT, WITHDRAW } = DYNAMICS_REQUEST_ACTIONS

const buildMessage = (
  body = { applicationReference, action: SUBMIT, type: 'MARINE_LICENCE' },
  receiveCount = '1'
) => ({
  Body: typeof body === 'string' ? body : JSON.stringify(body),
  ReceiptHandle: receiptHandle,
  Attributes: { ApproximateReceiveCount: receiveCount }
})

const expectEvent = (logFn, action) =>
  expect(logFn).toHaveBeenCalledWith(
    expect.objectContaining({
      event: expect.objectContaining({
        action,
        reference: applicationReference
      })
    }),
    expect.any(String)
  )

describe('marine licence dynamics worker-processor', () => {
  const setupMocks = (licence) => {
    const { mockMongo } = global
    const mockFindOne = vi.fn().mockResolvedValue(licence)
    const mockUpdateOne = vi
      .fn()
      .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
      findOne: mockFindOne,
      updateOne: mockUpdateOne
    }))
    const server = {
      db: mockMongo,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }
    return { server, mockFindOne, mockUpdateOne }
  }

  beforeEach(() => {
    vi.mocked(getDynamicsAccessToken).mockResolvedValue('token')
    vi.mocked(sendToDynamics).mockResolvedValue({})
    vi.mocked(deleteDynamicsJob).mockResolvedValue({})
  })

  describe('processDynamicsJob', () => {
    it.each([
      ['malformed JSON', 'not json'],
      ['a non-string reference', { applicationReference: 123, action: SUBMIT }],
      ['a blank reference', { applicationReference: '  ', action: SUBMIT }],
      ['an unsupported action', { applicationReference, action: 'update' }]
    ])('should discard a message with %s', async (_, body) => {
      const { server, mockFindOne } = setupMocks(null)

      await processDynamicsJob(server, buildMessage(body))

      expect(deleteDynamicsJob).toHaveBeenCalledWith(queueName, receiptHandle)
      expect(mockFindOne).not.toHaveBeenCalled()
      expect(sendToDynamics).not.toHaveBeenCalled()
      expect(server.logger.error).toHaveBeenCalled()
    })

    it('should discard the message when no licence has the reference', async () => {
      const { server } = setupMocks(null)

      await processDynamicsJob(server, buildMessage())

      expectEvent(
        server.logger.warn,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.LICENCE_NOT_FOUND
      )
      expect(deleteDynamicsJob).toHaveBeenCalledWith(queueName, receiptHandle)
      expect(sendToDynamics).not.toHaveBeenCalled()
    })

    it('should skip and delete an action that has already been sent', async () => {
      const { server, mockUpdateOne } = setupMocks({
        dynamicsOutbound: { submit: 'sent' }
      })

      await processDynamicsJob(server, buildMessage())

      expectEvent(
        server.logger.info,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.ALREADY_SENT
      )
      expect(sendToDynamics).not.toHaveBeenCalled()
      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(deleteDynamicsJob).toHaveBeenCalledWith(queueName, receiptHandle)
    })

    it('should leave a withdrawal on the queue until its submit has been sent', async () => {
      const { server } = setupMocks({ dynamicsOutbound: { submit: 'failed' } })

      await processDynamicsJob(
        server,
        buildMessage({ applicationReference, action: WITHDRAW })
      )

      expectEvent(
        server.logger.info,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.AWAITING_SUBMIT
      )
      expect(sendToDynamics).not.toHaveBeenCalled()
      expect(deleteDynamicsJob).not.toHaveBeenCalled()
    })

    it('should send a submit, flag it sent without touching updatedAt, then delete', async () => {
      const { server, mockFindOne, mockUpdateOne } = setupMocks({})

      await processDynamicsJob(server, buildMessage())

      expect(mockFindOne).toHaveBeenCalledWith(
        { applicationReference },
        { projection: { dynamicsOutbound: 1 } }
      )
      expect(getDynamicsAccessToken).toHaveBeenCalledWith({
        timeoutMs: 60_000
      })
      expect(sendToDynamics).toHaveBeenCalledWith(server, 'token', {
        applicationReferenceNumber: applicationReference,
        action: SUBMIT,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
      })
      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          applicationReference,
          'dynamicsOutbound.submit': { $ne: 'sent' }
        },
        { $set: { 'dynamicsOutbound.submit': 'sent' } }
      )
      expectEvent(server.logger.info, MARINE_LICENCE_DYNAMICS_EVENT_ACTION.SENT)
      expect(deleteDynamicsJob).toHaveBeenCalledWith(queueName, receiptHandle)
    })

    it('should send a withdrawal once its submit has been sent', async () => {
      const { server, mockUpdateOne } = setupMocks({
        dynamicsOutbound: { submit: 'sent' }
      })

      await processDynamicsJob(
        server,
        buildMessage({ applicationReference, action: WITHDRAW })
      )

      expect(sendToDynamics).toHaveBeenCalledWith(server, 'token', {
        applicationReferenceNumber: applicationReference,
        action: WITHDRAW,
        type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
      })
      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          applicationReference,
          'dynamicsOutbound.withdraw': { $ne: 'sent' }
        },
        { $set: { 'dynamicsOutbound.withdraw': 'sent' } }
      )
    })

    it('should leave the message for retry without marking it when a non-final attempt fails', async () => {
      const { server, mockUpdateOne } = setupMocks({})
      vi.mocked(sendToDynamics).mockRejectedValue(new Error('502'))

      await processDynamicsJob(server, buildMessage(undefined, '2'))

      expectEvent(
        server.logger.error,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.SEND_FAILED
      )
      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(deleteDynamicsJob).not.toHaveBeenCalled()
    })

    it('should mark the action failed when the final attempt fails, and leave the message to dead-letter', async () => {
      const { server, mockUpdateOne } = setupMocks({})
      vi.mocked(getDynamicsAccessToken).mockRejectedValue(new Error('timeout'))

      await processDynamicsJob(server, buildMessage(undefined, '3'))

      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          applicationReference,
          'dynamicsOutbound.submit': { $ne: 'sent' }
        },
        { $set: { 'dynamicsOutbound.submit': 'failed' } }
      )
      expectEvent(
        server.logger.warn,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.MARKED_FAILED
      )
      expect(deleteDynamicsJob).not.toHaveBeenCalled()
    })

    it('should log the retry wording when a non-final attempt fails', async () => {
      const { server } = setupMocks({})
      vi.mocked(sendToDynamics).mockRejectedValue(new Error('502'))

      await processDynamicsJob(server, buildMessage(undefined, '2'))

      expect(server.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({ reason: 'The queue will retry' })
        }),
        expect.stringContaining('the queue will retry')
      )
    })

    it('should log the dead-letter wording when the final attempt fails', async () => {
      const { server } = setupMocks({})
      vi.mocked(sendToDynamics).mockRejectedValue(new Error('502'))

      await processDynamicsJob(server, buildMessage(undefined, '3'))

      const [logged, text] = server.logger.error.mock.calls[0]
      expect(logged.event.reason).toBe(
        'No automatic retry; the action is being marked failed and will dead-letter'
      )
      expect(text).not.toContain('queue will retry')
    })

    it('should treat a failed licence lookup as a send failure on a non-final attempt', async () => {
      const { server, mockFindOne, mockUpdateOne } = setupMocks({})
      mockFindOne.mockRejectedValue(new Error('mongo down'))

      await processDynamicsJob(server, buildMessage(undefined, '1'))

      expectEvent(
        server.logger.error,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.SEND_FAILED
      )
      expect(sendToDynamics).not.toHaveBeenCalled()
      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(deleteDynamicsJob).not.toHaveBeenCalled()
    })

    it('should mark the action failed when the licence lookup fails on the final attempt', async () => {
      const { server, mockFindOne, mockUpdateOne } = setupMocks({})
      mockFindOne.mockRejectedValue(new Error('mongo down'))

      await processDynamicsJob(server, buildMessage(undefined, '3'))

      expectEvent(
        server.logger.error,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.SEND_FAILED
      )
      expect(mockUpdateOne).toHaveBeenCalledWith(expect.anything(), {
        $set: { 'dynamicsOutbound.submit': 'failed' }
      })
      expect(sendToDynamics).not.toHaveBeenCalled()
      expect(deleteDynamicsJob).not.toHaveBeenCalled()
    })

    it('should not treat a failed delete after a successful send as a send failure', async () => {
      const { server, mockUpdateOne } = setupMocks({})
      vi.mocked(deleteDynamicsJob).mockRejectedValue(new Error('SQS down'))

      await expect(
        processDynamicsJob(server, buildMessage(undefined, '3'))
      ).rejects.toThrow('SQS down')

      expect(sendToDynamics).toHaveBeenCalledTimes(1)
      expect(mockUpdateOne).toHaveBeenCalledTimes(1)
      expect(mockUpdateOne).toHaveBeenCalledWith(expect.anything(), {
        $set: { 'dynamicsOutbound.submit': 'sent' }
      })
      expect(server.logger.error).not.toHaveBeenCalled()
    })
  })

  describe('processDynamicsDlqJob', () => {
    it('should mark a dead-lettered action failed and delete it from the DLQ', async () => {
      const { server, mockUpdateOne } = setupMocks(null)

      await processDynamicsDlqJob(server, buildMessage())

      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          applicationReference,
          'dynamicsOutbound.submit': { $ne: 'sent' }
        },
        { $set: { 'dynamicsOutbound.submit': 'failed' } }
      )
      expectEvent(
        server.logger.warn,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.MARKED_FAILED
      )
      expect(deleteDynamicsJob).toHaveBeenCalledWith(dlqName, receiptHandle)
    })

    it('should log and delete a dead letter that matched nothing', async () => {
      const { server, mockUpdateOne } = setupMocks(null)
      mockUpdateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 })

      await processDynamicsDlqJob(server, buildMessage())

      expectEvent(
        server.logger.info,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.DEAD_LETTER_IGNORED
      )
      expect(server.logger.warn).not.toHaveBeenCalled()
      expect(deleteDynamicsJob).toHaveBeenCalledWith(dlqName, receiptHandle)
    })

    it('should log an ignored dead letter when the write changed nothing', async () => {
      const { server, mockUpdateOne } = setupMocks(null)
      mockUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 0 })

      await processDynamicsDlqJob(server, buildMessage())

      expectEvent(
        server.logger.info,
        MARINE_LICENCE_DYNAMICS_EVENT_ACTION.DEAD_LETTER_IGNORED
      )
      expect(server.logger.warn).not.toHaveBeenCalled()
    })

    it('should delete a malformed dead letter without writing', async () => {
      const { server, mockUpdateOne } = setupMocks(null)

      await processDynamicsDlqJob(server, buildMessage('not json'))

      expect(mockUpdateOne).not.toHaveBeenCalled()
      expect(deleteDynamicsJob).toHaveBeenCalledWith(dlqName, receiptHandle)
    })
  })
})
