import Boom from '@hapi/boom'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { ObjectId } from 'mongodb'
import { config } from '../../../config.js'
import {
  collectionMarineLicencePayments,
  collectionMarineLicences
} from '../../../shared/common/constants/db-collections.js'
import {
  createGovPayPayment,
  getGovPayPayment
} from '../../../shared/common/helpers/govpay/govpay-client.js'
import {
  PAYMENT_DESCRIPTION,
  PAYMENT_RETURN_PATH,
  PAYMENT_STATUS
} from '../../constants/payment.js'
import { submitMarineLicenceApplication } from './submit-marine-licence-application.js'

const LOCK_ATTEMPTS = 5
const LOCK_RETRY_DELAY_MS = 200

const lockKey = (applicationId) => `marine-licence-payment:${applicationId}`

const withApplicationLock = async (locker, applicationId, fn) => {
  for (let attempt = 1; attempt <= LOCK_ATTEMPTS; attempt++) {
    const lock = await locker.lock(lockKey(applicationId))
    if (lock) {
      try {
        return await fn()
      } finally {
        await lock.free()
      }
    }
    await sleep(LOCK_RETRY_DELAY_MS)
  }
  throw Boom.conflict(
    `A payment for marine licence ${applicationId} is already being processed`
  )
}

const payments = (db) => db.collection(collectionMarineLicencePayments)

const returnUrlFor = (returnId) =>
  `${config.get('govPay').returnBaseUrl}${PAYMENT_RETURN_PATH}/${returnId}`

const recordGovPayState = async (db, payment, govPayment) => {
  const { status, finished, code } = govPayment.state
  const now = new Date()
  const update = {
    status,
    finished,
    code: code ?? null,
    lastCheckedAt: now,
    updatedAt: now
  }
  await payments(db).updateOne({ _id: payment._id }, { $set: update })
  return { ...payment, ...update }
}

const startNewPayment = async ({
  db,
  applicationId,
  contactId,
  userName,
  userEmail
}) => {
  const { amountPence } = config.get('govPay')
  const returnId = randomUUID()

  const govPayment = await createGovPayPayment({
    amount: amountPence,
    reference: applicationId,
    description: PAYMENT_DESCRIPTION,
    returnUrl: returnUrlFor(returnId),
    metadata: { applicationId }
  })

  const now = new Date()
  await payments(db).insertOne({
    returnId,
    applicationId,
    contactId,
    userName,
    userEmail,
    paymentId: govPayment.payment_id,
    amount: amountPence,
    reference: applicationId,
    status: govPayment.state.status,
    finished: govPayment.state.finished,
    code: null,
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: now
  })

  return govPayment._links.next_url.href
}

// Pay's next_url works once, so a payment the user comes back to is resumed with
// the fresh next_url from a GET rather than the one stored at creation
const resumeUnfinishedPayment = async (db, payment) => {
  const govPayment = await getGovPayPayment(payment.paymentId)
  const updated = await recordGovPayState(db, payment, govPayment)

  if (!updated.finished) {
    return govPayment._links.next_url.href
  }
  if (updated.status === PAYMENT_STATUS.SUCCESS) {
    return returnUrlFor(payment.returnId)
  }
  return null
}

export const createOrResumePayment = async ({
  db,
  locker,
  applicationId,
  contactId,
  userName,
  userEmail
}) =>
  withApplicationLock(locker, applicationId, async () => {
    const unfinished = await payments(db).findOne(
      { applicationId, finished: false },
      { sort: { createdAt: -1 } }
    )

    const resumedUrl = unfinished
      ? await resumeUnfinishedPayment(db, unfinished)
      : null

    return (
      resumedUrl ??
      startNewPayment({ db, applicationId, contactId, userName, userEmail })
    )
  })

const submitPaidApplication = async ({ db, locker, logger, payment }) =>
  withApplicationLock(locker, payment.applicationId, async () => {
    const marineLicence = await db
      .collection(collectionMarineLicences)
      .findOne({ _id: ObjectId.createFromHexString(payment.applicationId) })

    if (!marineLicence) {
      throw Boom.notFound('Marine licence not found for payment')
    }

    if (marineLicence.applicationReference) {
      return marineLicence.applicationReference
    }

    const { applicationReference } = await submitMarineLicenceApplication({
      db,
      locker,
      logger,
      id: payment.applicationId,
      marineLicence,
      userName: payment.userName,
      userEmail: payment.userEmail,
      updatedAt: new Date(),
      updatedBy: payment.contactId
    })

    logger.info(
      {
        event: {
          action: 'marine_licence_payment_submitted',
          outcome: 'success'
        }
      },
      `Submitted marine licence ${payment.applicationId} as ${applicationReference} after payment ${payment.paymentId}`
    )

    return applicationReference
  })

const toPaymentResult = (payment, applicationReference) => ({
  status: payment.status,
  code: payment.code,
  finished: payment.finished,
  applicationId: payment.applicationId,
  applicationReference: applicationReference ?? null
})

export const resolvePayment = async ({ db, locker, logger, payment }) => {
  const current =
    payment.status === PAYMENT_STATUS.SUCCESS
      ? payment
      : await recordGovPayState(
          db,
          payment,
          await getGovPayPayment(payment.paymentId)
        )

  if (current.status !== PAYMENT_STATUS.SUCCESS) {
    return toPaymentResult(current)
  }

  const applicationReference =
    current.applicationReference ??
    (await submitPaidApplication({ db, locker, logger, payment: current }))

  if (!current.applicationReference) {
    await payments(db).updateOne(
      { _id: current._id },
      { $set: { applicationReference, updatedAt: new Date() } }
    )
  }

  return toPaymentResult(current, applicationReference)
}

export const findPaymentByReturnId = (db, returnId) =>
  payments(db).findOne({ returnId })

export const findPaymentsToReconcile = (db, { olderThan, limit }) =>
  payments(db)
    .find({
      $or: [
        { finished: false, createdAt: { $lt: olderThan } },
        { status: PAYMENT_STATUS.SUCCESS, applicationReference: null }
      ]
    })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray()
