import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'
import { config } from '../../../../config.js'
import { createLogger, structureErrorForECS } from '../logging/logger.js'

const logger = createLogger()

const getGovPayConfig = () => {
  const govPayConfig = config.get('govPay')
  if (!govPayConfig.apiKey) {
    throw Boom.internal('GOVPAY_API_KEY is not configured')
  }
  return govPayConfig
}

const requestOptions = ({ apiKey, timeoutMs }) => ({
  headers: {
    authorization: `Bearer ${apiKey}`,
    accept: 'application/json'
  },
  timeout: timeoutMs,
  json: 'force'
})

const toGovPayError = (error, operation) => {
  const statusCode = error.output?.statusCode
  const { code, description, message } = error.data?.payload ?? {}
  const details = [
    statusCode && `with ${statusCode}`,
    code && `(${code})`
  ].filter(Boolean)
  const summary = [`GOV.UK Pay ${operation} failed`, ...details].join(' ')

  logger.error(
    {
      ...structureErrorForECS(error),
      service: 'govpay',
      event: { action: `govpay-${operation.replaceAll(' ', '-')}` }
    },
    `${summary}: ${description ?? message ?? error.message}`
  )

  return Boom.badGateway(summary)
}

export const createGovPayPayment = async ({
  amount,
  reference,
  description,
  returnUrl,
  metadata
}) => {
  const govPayConfig = getGovPayConfig()
  const options = requestOptions(govPayConfig)
  try {
    const { payload } = await Wreck.post(`${govPayConfig.apiUrl}/v1/payments`, {
      ...options,
      headers: { ...options.headers, 'content-type': 'application/json' },
      payload: JSON.stringify({
        amount,
        reference,
        description,
        return_url: returnUrl,
        metadata,
        language: 'en'
      })
    })
    return payload
  } catch (error) {
    throw toGovPayError(error, 'create payment')
  }
}

export const getGovPayPayment = async (paymentId) => {
  const govPayConfig = getGovPayConfig()
  try {
    const { payload } = await Wreck.get(
      `${govPayConfig.apiUrl}/v1/payments/${encodeURIComponent(paymentId)}`,
      requestOptions(govPayConfig)
    )
    return payload
  } catch (error) {
    throw toGovPayError(error, 'get payment')
  }
}
