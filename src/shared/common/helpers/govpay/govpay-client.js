import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'
import { config } from '../../../../config.js'

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
  const code = error.data?.payload?.code
  const details = [
    statusCode && `with ${statusCode}`,
    code && `(${code})`
  ].filter(Boolean)
  return Boom.badGateway(
    [`GOV.UK Pay ${operation} failed`, ...details].join(' ')
  )
}

export const createGovPayPayment = async ({
  amount,
  reference,
  description,
  returnUrl,
  metadata
}) => {
  const govPayConfig = getGovPayConfig()
  try {
    const { payload } = await Wreck.post(`${govPayConfig.apiUrl}/v1/payments`, {
      ...requestOptions(govPayConfig),
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
