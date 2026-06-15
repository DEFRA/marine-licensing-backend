import { createPoliciesPollerPlugin } from './policies-poller.js'
import { receiveDlqJobs } from '../../marine-licences/api/helpers/policies-sqs-client.js'
import { processDlqJob } from '../../marine-licences/api/helpers/policies-worker-processor.js'

export const policiesDlqWorkerPlugin = createPoliciesPollerPlugin({
  name: 'policies-dlq-worker',
  receiveMessages: receiveDlqJobs,
  processMessage: processDlqJob
})
