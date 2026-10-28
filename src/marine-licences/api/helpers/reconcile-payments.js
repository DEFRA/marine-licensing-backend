import { config } from '../../../config.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import {
  findPaymentsToReconcile,
  resolvePayment
} from '../services/payment.service.js'

const BATCH_LIMIT = 100
const MS_PER_MINUTE = 60_000

const resolveOne = async (server, payment) => {
  try {
    const result = await resolvePayment({
      db: server.db,
      locker: server.locker,
      logger: server.logger,
      payment
    })
    if (result.applicationReference) {
      return 'submitted'
    }
    return result.finished ? 'failed' : 'unfinished'
  } catch (error) {
    server.logger.error(
      structureErrorForECS(error),
      `Failed to reconcile payment ${payment.paymentId} for marine licence ${payment.applicationId}`
    )
    return 'errored'
  }
}

export const reconcilePayments = async (server, now = new Date()) => {
  const { isEnabled, reconcileAfterMinutes } = config.get('govPay')
  if (!isEnabled) {
    return { summary: 'GOV.UK Pay disabled; nothing reconciled' }
  }

  const olderThan = new Date(
    now.getTime() - reconcileAfterMinutes * MS_PER_MINUTE
  )
  const toReconcile = await findPaymentsToReconcile(server.db, {
    olderThan,
    limit: BATCH_LIMIT
  })

  const counts = { submitted: 0, failed: 0, unfinished: 0, errored: 0 }
  // Sequential on purpose: each payment takes the application lock and may call Pay
  for (const payment of toReconcile) {
    counts[await resolveOne(server, payment)]++
  }

  return {
    summary: `${toReconcile.length} payments checked — ${counts.submitted} submitted; ${counts.failed} failed; ${counts.unfinished} still unfinished; ${counts.errored} errored`
  }
}
