import { createMasPollerPlugin } from './poller.js'
import { receiveMasDlqMessages } from '../../../marine-licences/api/helpers/mas/sqs-client.js'
import { processMasDlqMessage } from '../../../marine-licences/api/helpers/mas/worker-processor.js'

export const masDlqWorkerPlugin = createMasPollerPlugin({
  name: 'mas-dlq-worker',
  receiveMessages: receiveMasDlqMessages,
  processMessage: processMasDlqMessage
})
