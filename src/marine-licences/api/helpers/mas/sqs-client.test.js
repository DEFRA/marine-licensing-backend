import { vi } from 'vitest'
import {
  receiveMasMessages,
  receiveMasDlqMessages,
  deleteMasMessage,
  MAS_RECEIVE_OPTIONS
} from './sqs-client.js'

vi.mock('../../../../shared/common/helpers/sqs/sqs-client.js', () => ({
  receiveMessages: vi.fn().mockResolvedValue([]),
  deleteMessage: vi.fn().mockResolvedValue({})
}))

import {
  receiveMessages,
  deleteMessage
} from '../../../../shared/common/helpers/sqs/sqs-client.js'

const sqsQueueName = 'marine_licensing_mas'
const sqsDlqName = 'marine_licensing_mas-deadletter'

describe('mas-sqs-client', () => {
  it('receiveMasMessages calls receiveMessages with the main queue and MAS options', async () => {
    await receiveMasMessages()

    expect(receiveMessages).toHaveBeenCalledWith(
      sqsQueueName,
      MAS_RECEIVE_OPTIONS
    )
  })

  it('receiveMasDlqMessages calls receiveMessages with the DLQ and MAS options', async () => {
    await receiveMasDlqMessages()

    expect(receiveMessages).toHaveBeenCalledWith(
      sqsDlqName,
      MAS_RECEIVE_OPTIONS
    )
  })

  it('deleteMasMessage calls deleteMessage with the given queue name and receipt handle', async () => {
    await deleteMasMessage(sqsQueueName, 'receipt-1')

    expect(deleteMessage).toHaveBeenCalledWith(sqsQueueName, 'receipt-1')
  })
})
