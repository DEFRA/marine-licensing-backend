import { createSqsPollerPlugin } from '../../common/helpers/sqs/create-poller-plugin.js'
import { receiveMasMessages } from '../../../marine-licences/api/helpers/mas/sqs-client.js'
import { processMasMessage } from '../../../marine-licences/api/helpers/mas/worker-processor.js'

export const masWorkerPlugin = createSqsPollerPlugin({
  name: 'mas-worker',
  configKey: 'mas',
  receiveMessages: receiveMasMessages,
  processMessage: processMasMessage
})
