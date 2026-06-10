import { createPoliciesPollerPlugin } from './policies-poller.js'
import { receivePolicyJobs } from '../../marine-licences/api/helpers/policies-sqs-client.js'
import { processPolicyJob } from '../../marine-licences/api/helpers/policies-worker-processor.js'

export const policiesWorkerPlugin = createPoliciesPollerPlugin({
  name: 'policies-worker',
  receiveMessages: receivePolicyJobs,
  processMessage: processPolicyJob
})
