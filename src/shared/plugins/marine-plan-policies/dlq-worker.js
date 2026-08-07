import { createSqsPollerPlugin } from '../../common/helpers/sqs/create-poller-plugin.js'
import { receiveDlqJobs } from '../../../marine-licences/api/helpers/marine-plan-policies/sqs-client.js'
import { processDlqJob } from '../../../marine-licences/api/helpers/marine-plan-policies/worker-processor.js'

export const marinePlanPoliciesDlqWorkerPlugin = createSqsPollerPlugin({
  name: 'marine-plan-policies-dlq-worker',
  configKey: 'marinePlanPolicies',
  receiveMessages: receiveDlqJobs,
  processMessage: processDlqJob
})
