import { vi } from 'vitest'
import {
  sendPolicyJob,
  receivePolicyJobs,
  receiveDlqJobs,
  deletePolicyJob,
  MPP_RECEIVE_OPTIONS
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

const sqsQueueName = 'marine_licensing_policies'
const sqsDlqName = 'marine_licensing_policies-deadletter'

describe('policies-sqs-client', () => {
  it('sendPolicyJob calls sendMessage with the queue name and serialised ids', async () => {
    await sendPolicyJob({ licenceId: 'licence-1', policyJobId: 'job-1' })

    expect(sendMessage).toHaveBeenCalledWith(
      sqsQueueName,
      JSON.stringify({ licenceId: 'licence-1', policyJobId: 'job-1' })
    )
  })

  it('receivePolicyJobs calls receiveMessages with the main queue and MPP options', async () => {
    await receivePolicyJobs()

    expect(receiveMessages).toHaveBeenCalledWith(
      sqsQueueName,
      MPP_RECEIVE_OPTIONS
    )
  })

  it('receiveDlqJobs calls receiveMessages with the DLQ and MPP options', async () => {
    await receiveDlqJobs()

    expect(receiveMessages).toHaveBeenCalledWith(
      sqsDlqName,
      MPP_RECEIVE_OPTIONS
    )
  })

  it('deletePolicyJob calls deleteMessage with the given queue name and receipt handle', async () => {
    await deletePolicyJob(sqsQueueName, 'receipt-1')

    expect(deleteMessage).toHaveBeenCalledWith(sqsQueueName, 'receipt-1')
  })
})
