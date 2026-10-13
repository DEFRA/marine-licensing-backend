import { config } from '../../../config.js'
import { createSqsPollerPlugin } from '../../common/helpers/sqs/create-poller-plugin.js'
import { receiveDynamicsDlqJobs } from '../../../marine-licences/api/helpers/dynamics/sqs-client.js'
import { processDynamicsDlqJob } from '../../../marine-licences/api/helpers/dynamics/worker-processor.js'

export const marineLicenceDynamicsDlqWorkerPlugin = createSqsPollerPlugin({
  name: 'marine-licence-dynamics-dlq-worker',
  isEnabled: () => config.get('dynamics').isDynamicsEnabled,
  receiveMessages: receiveDynamicsDlqJobs,
  processMessage: processDynamicsDlqJob
})
