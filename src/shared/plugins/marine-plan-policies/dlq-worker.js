import { createMarinePlanPoliciesPollerPlugin } from './poller.js'
import { receiveDlqJobs } from '../../../marine-licences/api/helpers/marine-plan-policies/sqs-client.js'
import { processDlqJob } from '../../../marine-licences/api/helpers/marine-plan-policies/worker-processor.js'

export const marinePlanPoliciesDlqWorkerPlugin =
  createMarinePlanPoliciesPollerPlugin({
    name: 'marine-plan-policies-dlq-worker',
    receiveMessages: receiveDlqJobs,
    processMessage: processDlqJob
  })
