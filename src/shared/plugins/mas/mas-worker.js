import { createMasPollerPlugin } from './poller.js'
import { receiveMasMessages } from '../../../marine-licences/api/helpers/mas/sqs-client.js'
import { processMasMessage } from '../../../marine-licences/api/helpers/mas/worker-processor.js'

export const masWorkerPlugin = createMasPollerPlugin({
  name: 'mas-worker',
  receiveMessages: receiveMasMessages,
  processMessage: processMasMessage
})
