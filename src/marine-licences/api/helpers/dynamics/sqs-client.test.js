import { vi } from 'vitest'
import {
  sendDynamicsJob,
  receiveDynamicsJobs,
  receiveDynamicsDlqJobs,
  deleteDynamicsJob,
  DYNAMICS_RECEIVE_OPTIONS
} from './sqs-client.js'

vi.mock('../../../../shared/common/helpers/sqs/sqs-client.js', () => ({
  sendMessage: vi.fn().mockResolvedValue({}),
  receiveMessages: vi.fn().mockResolvedValue([]),
  deleteMessage: vi.fn().mockResolvedValue({})
}))

import {
  sendMessage,
  receiveMessages,
  deleteMessage
} from '../../../../shared/common/helpers/sqs/sqs-client.js'

const sqsQueueName = 'marine_licensing_d365_marine_licence'
const sqsDlqName = 'marine_licensing_d365_marine_licence-deadletter'

describe('marine licence dynamics sqs-client', () => {
  it('sendDynamicsJob sends the reference, action and marine licence type to the main queue', async () => {
    await sendDynamicsJob({
      applicationReference: 'MLA/2026/00001',
      action: 'submit'
    })

    expect(sendMessage).toHaveBeenCalledWith(
      sqsQueueName,
      JSON.stringify({
        applicationReference: 'MLA/2026/00001',
        action: 'submit',
        type: 'MARINE_LICENCE'
      })
    )
  })

  it('receiveDynamicsJobs long-polls the main queue with receive counts', async () => {
    await receiveDynamicsJobs()

    expect(receiveMessages).toHaveBeenCalledWith(
      sqsQueueName,
      DYNAMICS_RECEIVE_OPTIONS
    )
    expect(DYNAMICS_RECEIVE_OPTIONS).toEqual({
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
      MessageSystemAttributeNames: ['ApproximateReceiveCount']
    })
  })

  it('receiveDynamicsDlqJobs long-polls the dead-letter queue', async () => {
    await receiveDynamicsDlqJobs()

    expect(receiveMessages).toHaveBeenCalledWith(
      sqsDlqName,
      DYNAMICS_RECEIVE_OPTIONS
    )
  })

  it('deleteDynamicsJob deletes from the given queue', async () => {
    await deleteDynamicsJob(sqsQueueName, 'receipt-1')

    expect(deleteMessage).toHaveBeenCalledWith(sqsQueueName, 'receipt-1')
  })
})
