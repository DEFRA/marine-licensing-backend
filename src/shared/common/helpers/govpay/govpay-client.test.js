import { describe, it, expect, vi, beforeEach } from 'vitest'
import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import { config } from '../../../../config.js'
import { createGovPayPayment, getGovPayPayment } from './govpay-client.js'

vi.mock('@hapi/wreck')

const govPayConfig = {
  apiUrl: 'http://stub/govpay',
  apiKey: 'test-key',
  timeoutMs: 1000
}

describe('govpay-client', () => {
  beforeEach(() => {
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'govPay' ? govPayConfig : undefined
    )
  })

  describe('createGovPayPayment', () => {
    it('posts the payment with a Bearer key and returns the payload', async () => {
      Wreck.post.mockResolvedValue({ payload: { payment_id: 'pay-1' } })

      const result = await createGovPayPayment({
        amount: 5000,
        reference: 'REF',
        description: 'Fee',
        returnUrl: 'http://frontend/return/abc',
        metadata: { applicationId: 'app-1' }
      })

      expect(result).toEqual({ payment_id: 'pay-1' })
      const [url, options] = Wreck.post.mock.calls[0]
      expect(url).toBe('http://stub/govpay/v1/payments')
      expect(options.headers.authorization).toBe('Bearer test-key')
      expect(JSON.parse(options.payload)).toEqual({
        amount: 5000,
        reference: 'REF',
        description: 'Fee',
        return_url: 'http://frontend/return/abc',
        metadata: { applicationId: 'app-1' },
        language: 'en'
      })
    })

    it('wraps a Pay error as a 502 with the Pay error code', async () => {
      const error = Boom.badRequest('bad')
      error.data = { payload: { code: 'P0102' } }
      Wreck.post.mockRejectedValue(error)

      await expect(
        createGovPayPayment({ amount: 1, reference: 'r', description: 'd' })
      ).rejects.toMatchObject({
        output: { statusCode: 502 },
        message: 'GOV.UK Pay create payment failed with 400 (P0102)'
      })
    })

    it('fails without calling Pay when no API key is configured', async () => {
      config.get.mockReturnValue({ ...govPayConfig, apiKey: null })

      await expect(
        createGovPayPayment({ amount: 1, reference: 'r', description: 'd' })
      ).rejects.toThrow('GOVPAY_API_KEY is not configured')
      expect(Wreck.post).not.toHaveBeenCalled()
    })
  })

  describe('getGovPayPayment', () => {
    it('gets the payment by an encoded id', async () => {
      Wreck.get.mockResolvedValue({ payload: { payment_id: 'a/b' } })

      const result = await getGovPayPayment('a/b')

      expect(result).toEqual({ payment_id: 'a/b' })
      expect(Wreck.get.mock.calls[0][0]).toBe(
        'http://stub/govpay/v1/payments/a%2Fb'
      )
    })

    it('wraps a network error as a 502', async () => {
      Wreck.get.mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(getGovPayPayment('p')).rejects.toMatchObject({
        output: { statusCode: 502 },
        message: 'GOV.UK Pay get payment failed'
      })
    })
  })
})
