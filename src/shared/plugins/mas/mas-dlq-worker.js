import { createSqsPollerPlugin } from '../../common/helpers/sqs/create-poller-plugin.js'
import { receiveMasDlqMessages } from '../../../marine-licences/api/helpers/mas/sqs-client.js'
import { processMasDlqMessage } from '../../../marine-licences/api/helpers/mas/worker-processor.js'

export const masDlqWorkerPlugin = createSqsPollerPlugin({
  name: 'mas-dlq-worker',
  configKey: 'mas',
  receiveMessages: receiveMasDlqMessages,
  processMessage: processMasDlqMessage
})
