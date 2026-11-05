import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { config } from '../../../config.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import {
  collectionMarineLicencePayments,
  collectionMarineLicences
} from '../../../shared/common/constants/db-collections.js'
import {
  createGovPayPayment,
  getGovPayPayment
} from '../../../shared/common/helpers/govpay/govpay-client.js'
import { reconcilePayments } from '../helpers/reconcile-payments.js'
import {
  createCompleteMarineLicence,
  mockCredentials
} from '../../../../tests/test.fixture.js'
import { setupTestServer } from '../../../../tests/test-server.js'

vi.mock('../../../shared/common/helpers/govpay/govpay-client.js')

const auth = { strategy: 'jwt', credentials: mockCredentials }
const otherUserAuth = {
  strategy: 'jwt',
  credentials: { contactId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }
}

const govPayResponse = (paymentId, state, nextUrl) => ({
  payment_id: paymentId,
  state,
  _links: nextUrl ? { next_url: { href: nextUrl } } : {}
})

describe('marine licence payment routes', async () => {
  const getServer = await setupTestServer()
  let db
  let marineLicenceId
  let govPayEnabled

  const createPaymentRequest = (requestAuth = auth) =>
    getServer().inject({
      method: 'POST',
      url: '/marine-licence/payment',
      payload: {
        id: marineLicenceId.toHexString(),
        userEmail: 'test@example.com',
        userName: 'Test User'
      },
      auth: requestAuth
    })

  const getPaymentRequest = (returnId, requestAuth = auth) =>
    getServer().inject({
      method: 'GET',
      url: `/marine-licence/payment/${returnId}`,
      auth: requestAuth
    })

  const storedPayment = () =>
    db
      .collection(collectionMarineLicencePayments)
      .findOne({ applicationId: marineLicenceId.toHexString() })

  beforeAll(() => {
    db = globalThis.mockMongo
    const realGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'govPay'
        ? { ...realGet('govPay'), apiKey: 'test-key', isEnabled: govPayEnabled }
        : realGet(key)
    )
  })

  beforeEach(async () => {
    govPayEnabled = true
    marineLicenceId = new ObjectId()
    await db.collection(collectionMarineLicencePayments).deleteMany({})
    await db.collection(collectionMarineLicences).insertOne(
      createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId: mockCredentials.contactId,
        marinePlanPolicyJob: 'ready'
      })
    )
    createGovPayPayment.mockResolvedValue(
      govPayResponse(
        'pay-1',
        { status: 'created', finished: false },
        'http://pay/next/1'
      )
    )
  })

  describe('POST /marine-licence/payment', () => {
    it('creates a payment, stores it and returns next_url', async () => {
      const response = await createPaymentRequest()

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.payload).value).toEqual({
        nextUrl: 'http://pay/next/1'
      })

      const payment = await storedPayment()
      expect(payment).toMatchObject({
        paymentId: 'pay-1',
        contactId: mockCredentials.contactId,
        userEmail: 'test@example.com',
        amount: 5000,
        status: 'created',
        finished: false
      })
      expect(createGovPayPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          returnUrl: `http://localhost:3000/marine-licence/payment/return/${payment.returnId}`,
          metadata: { applicationId: marineLicenceId.toHexString() }
        })
      )
    })

    it('resumes an unfinished payment with a fresh next_url', async () => {
      await createPaymentRequest()
      getGovPayPayment.mockResolvedValue(
        govPayResponse(
          'pay-1',
          { status: 'started', finished: false },
          'http://pay/next/fresh'
        )
      )

      const response = await createPaymentRequest()

      expect(JSON.parse(response.payload).value.nextUrl).toBe(
        'http://pay/next/fresh'
      )
      expect(createGovPayPayment).toHaveBeenCalledTimes(1)
    })

    it('creates a new payment when the previous one failed', async () => {
      await createPaymentRequest()
      getGovPayPayment.mockResolvedValue(
        govPayResponse('pay-1', {
          status: 'failed',
          finished: true,
          code: 'P0030'
        })
      )
      createGovPayPayment.mockResolvedValue(
        govPayResponse(
          'pay-2',
          { status: 'created', finished: false },
          'http://pay/next/2'
        )
      )

      const response = await createPaymentRequest()

      expect(JSON.parse(response.payload).value.nextUrl).toBe(
        'http://pay/next/2'
      )
      expect(
        await db.collection(collectionMarineLicencePayments).countDocuments()
      ).toBe(2)
    })

    it('returns 404 when GOV.UK Pay is disabled', async () => {
      govPayEnabled = false

      const response = await createPaymentRequest()

      expect(response.statusCode).toBe(404)
      expect(createGovPayPayment).not.toHaveBeenCalled()
    })

    it('returns 409 when the licence has already been submitted', async () => {
      await db
        .collection(collectionMarineLicences)
        .updateOne(
          { _id: marineLicenceId },
          { $set: { applicationReference: 'MLA/2025/10001' } }
        )

      const response = await createPaymentRequest()

      expect(response.statusCode).toBe(409)
    })

    it('returns 400 when the licence is incomplete', async () => {
      await db
        .collection(collectionMarineLicences)
        .updateOne(
          { _id: marineLicenceId },
          { $unset: { projectBackground: '' } }
        )

      const response = await createPaymentRequest()

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.payload).message).toContain(
        'Missing sections: projectBackground'
      )
      expect(createGovPayPayment).not.toHaveBeenCalled()
    })

    it('returns 403 for another user', async () => {
      const response = await createPaymentRequest(otherUserAuth)

      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /marine-licence/payment/{returnId}', () => {
    it('submits the licence when the payment succeeded', async () => {
      await createPaymentRequest()
      const { returnId } = await storedPayment()
      getGovPayPayment.mockResolvedValue(
        govPayResponse('pay-1', { status: 'success', finished: true })
      )

      const response = await getPaymentRequest(returnId)

      expect(response.statusCode).toBe(200)
      const { value } = JSON.parse(response.payload)
      expect(value).toMatchObject({
        status: 'success',
        finished: true,
        applicationId: marineLicenceId.toHexString(),
        applicationReference: expect.stringMatching(/^MLA\//)
      })

      const licence = await db
        .collection(collectionMarineLicences)
        .findOne({ _id: marineLicenceId })
      expect(licence.status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)
      expect(licence.applicationReference).toBe(value.applicationReference)
      expect((await storedPayment()).applicationReference).toBe(
        value.applicationReference
      )
    })

    it('returns the same reference on a repeat visit without calling Pay', async () => {
      await createPaymentRequest()
      const { returnId } = await storedPayment()
      getGovPayPayment.mockResolvedValue(
        govPayResponse('pay-1', { status: 'success', finished: true })
      )
      const first = JSON.parse((await getPaymentRequest(returnId)).payload)
      getGovPayPayment.mockClear()

      const second = JSON.parse((await getPaymentRequest(returnId)).payload)

      expect(second.value.applicationReference).toBe(
        first.value.applicationReference
      )
      expect(getGovPayPayment).not.toHaveBeenCalled()
    })

    it('leaves the licence in draft when the payment was declined', async () => {
      await createPaymentRequest()
      const { returnId } = await storedPayment()
      getGovPayPayment.mockResolvedValue(
        govPayResponse('pay-1', {
          status: 'failed',
          finished: true,
          code: 'P0010'
        })
      )

      const response = await getPaymentRequest(returnId)

      expect(JSON.parse(response.payload).value).toMatchObject({
        status: 'failed',
        code: 'P0010',
        applicationReference: null
      })
      const licence = await db
        .collection(collectionMarineLicences)
        .findOne({ _id: marineLicenceId })
      expect(licence.status).toBe(MARINE_LICENCE_STATUS.DRAFT)
    })

    it('returns 403 for another user', async () => {
      await createPaymentRequest()
      const { returnId } = await storedPayment()

      const response = await getPaymentRequest(returnId, otherUserAuth)

      expect(response.statusCode).toBe(403)
      expect(getGovPayPayment).not.toHaveBeenCalled()
    })

    it('returns 404 for an unknown return id', async () => {
      const response = await getPaymentRequest(
        '7d6b8f8e-1c7a-4f3e-9b2a-0c1d2e3f4a5b'
      )

      expect(response.statusCode).toBe(404)
    })

    it('returns 400 for a return id that is not a UUID', async () => {
      const response = await getPaymentRequest('not-a-uuid')

      expect(response.statusCode).toBe(400)
    })
  })

  describe('reconcilePayments', () => {
    const ageStoredPayment = (minutes) =>
      db
        .collection(collectionMarineLicencePayments)
        .updateOne(
          { applicationId: marineLicenceId.toHexString() },
          { $set: { createdAt: new Date(Date.now() - minutes * 60_000) } }
        )

    it('submits a paid licence the user never returned to', async () => {
      await createPaymentRequest()
      await ageStoredPayment(91)
      getGovPayPayment.mockResolvedValue(
        govPayResponse('pay-1', { status: 'success', finished: true })
      )

      const { summary } = await reconcilePayments(getServer())

      expect(summary).toBe(
        '1 payments checked — 1 submitted; 0 failed; 0 still unfinished; 0 errored'
      )
      const licence = await db
        .collection(collectionMarineLicences)
        .findOne({ _id: marineLicenceId })
      expect(licence.status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)
    })

    it('marks an expired payment failed and leaves the licence in draft', async () => {
      await createPaymentRequest()
      await ageStoredPayment(91)
      getGovPayPayment.mockResolvedValue(
        govPayResponse('pay-1', {
          status: 'failed',
          finished: true,
          code: 'P0020'
        })
      )

      const { summary } = await reconcilePayments(getServer())

      expect(summary).toContain('1 failed')
      expect(await storedPayment()).toMatchObject({
        finished: true,
        code: 'P0020'
      })
    })

    it('leaves payments younger than the expiry window alone', async () => {
      await createPaymentRequest()
      await ageStoredPayment(30)

      const { summary } = await reconcilePayments(getServer())

      expect(summary).toMatch(/^0 payments checked/)
      expect(getGovPayPayment).not.toHaveBeenCalled()
    })

    it('counts a Pay error without stopping the run', async () => {
      await createPaymentRequest()
      await ageStoredPayment(91)
      getGovPayPayment.mockRejectedValue(new Error('Pay is down'))

      const { summary } = await reconcilePayments(getServer())

      expect(summary).toContain('1 errored')
    })

    it('does nothing when GOV.UK Pay is disabled', async () => {
      govPayEnabled = false

      const { summary } = await reconcilePayments(getServer())

      expect(summary).toBe('GOV.UK Pay disabled; nothing reconciled')
    })
  })
})
