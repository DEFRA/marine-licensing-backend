import { createMarinePlanPoliciesPollerPlugin } from './poller.js'
import { receivePolicyJobs } from '../../../marine-licences/api/helpers/marine-plan-policies/sqs-client.js'
import { processPolicyJob } from '../../../marine-licences/api/helpers/marine-plan-policies/worker-processor.js'

export const marinePlanPoliciesWorkerPlugin =
  createMarinePlanPoliciesPollerPlugin({
    name: 'marine-plan-policies-worker',
    receiveMessages: receivePolicyJobs,
    processMessage: processPolicyJob
  })
