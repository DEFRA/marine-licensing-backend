import { createSqsPollerPlugin } from '../../common/helpers/sqs/create-poller-plugin.js'
import { receivePolicyJobs } from '../../../marine-licences/api/helpers/marine-plan-policies/sqs-client.js'
import { processPolicyJob } from '../../../marine-licences/api/helpers/marine-plan-policies/worker-processor.js'

export const marinePlanPoliciesWorkerPlugin = createSqsPollerPlugin({
  name: 'marine-plan-policies-worker',
  configKey: 'marinePlanPolicies',
  receiveMessages: receivePolicyJobs,
  processMessage: processPolicyJob
})
