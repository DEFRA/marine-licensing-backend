import { config } from '../../../config.js'
import { createSqsPollerPlugin } from '../../common/helpers/sqs/create-poller-plugin.js'
import { receiveDynamicsJobs } from '../../../marine-licences/api/helpers/dynamics/sqs-client.js'
import { processDynamicsJob } from '../../../marine-licences/api/helpers/dynamics/worker-processor.js'

export const marineLicenceDynamicsWorkerPlugin = createSqsPollerPlugin({
  name: 'marine-licence-dynamics-worker',
  isEnabled: () => config.get('dynamics').isDynamicsEnabled,
  receiveMessages: receiveDynamicsJobs,
  processMessage: processDynamicsJob
})
