import Wreck from '@hapi/wreck'
import { config } from '../../../../config.js'
import { formatNumber } from '../format-number.js'
import { getDynamicsAccessToken } from './get-access-token.js'
import { dynamicsHeaders } from './get-contact-details.js'

const WARM_UP_TIMEOUT_MS = 30_000

// Exists to keep Dataverse's cache warm: the response body is irrelevant and
// the timing is the signal. Errors propagate; the scheduler logs the outcome.
export const warmUpDynamics = async ({ path }) => {
  const { isDynamicsEnabled, contactDetails } = config.get('dynamics')
  if (!isDynamicsEnabled) {
    return { summary: 'skipped: Dynamics disabled' }
  }

  const tokenStart = Date.now()
  const accessToken = await getDynamicsAccessToken({
    type: 'contactDetails',
    timeoutMs: WARM_UP_TIMEOUT_MS
  })
  const requestStart = Date.now()
  const response = await Wreck.get(`${contactDetails.baseUrl}${path}`, {
    headers: dynamicsHeaders(accessToken),
    timeout: WARM_UP_TIMEOUT_MS
  })
  const requestEnd = Date.now()

  return {
    summary: `${response.res.statusCode} from Dataverse; token ${formatNumber(requestStart - tokenStart)}ms, request ${formatNumber(requestEnd - requestStart)}ms`
  }
}
