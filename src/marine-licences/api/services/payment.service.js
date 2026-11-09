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
  PAYMENT_STATUS,
  PAYMENT_SUBMISSION_ERROR
} from '../../constants/payment.js'
import { submitMarineLicenceApplication } from './submit-marine-licence-application.js'

const LOCK_ATTEMPTS = 5
const LOCK_RETRY_DELAY_MS = 200

const lockKey = (applicationId) => `marine-licence-payment:${applicationId}`

const withApplicationLock = async (locker, applicationId, fn, attempt = 1) => {
  const lock = await locker.lock(lockKey(applicationId))
  if (lock) {
    try {
      return await fn()
    } finally {
      await lock.free()
    }
  }
  if (attempt >= LOCK_ATTEMPTS) {
    throw Boom.conflict(
      `A payment for marine licence ${applicationId} is already being processed`
    )
  }
  await sleep(LOCK_RETRY_DELAY_MS)
  return withApplicationLock(locker, applicationId, fn, attempt + 1)
}

const payments = (db) => db.collection(collectionMarineLicencePayments)

const returnUrlFor = (returnId) =>
  `${config.get('frontEndBaseUrl')}${PAYMENT_RETURN_PATH}/${returnId}`

const nextUrlOf = (govPayment) => govPayment._links?.next_url?.href ?? null

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

// The local row is written before the Pay payment exists, so a Pay payment
// is never left without a record carrying its returnId
const startNewPayment = async ({
  db,
  applicationId,
  contactId,
  userName,
  userEmail
}) => {
  const { amountPence } = config.get('govPay')
  const returnId = randomUUID()
  const now = new Date()

  const { insertedId } = await payments(db).insertOne({
    returnId,
    applicationId,
    contactId,
    userName,
    userEmail,
    paymentId: null,
    amount: amountPence,
    status: null,
    finished: false,
    code: null,
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: now
  })

  let govPayment
  try {
    govPayment = await createGovPayPayment({
      amount: amountPence,
      reference: applicationId,
      description: PAYMENT_DESCRIPTION,
      returnUrl: returnUrlFor(returnId),
      metadata: { returnId }
    })
  } catch (error) {
    await payments(db).deleteOne({ _id: insertedId })
    throw error
  }

  await payments(db).updateOne(
    { _id: insertedId },
    {
      $set: {
        paymentId: govPayment.payment_id,
        status: govPayment.state.status,
        finished: govPayment.state.finished,
        updatedAt: new Date()
      }
    }
  )

  return nextUrlOf(govPayment)
}

// Pay's next_url works once, so a payment the user comes back to is resumed with
// the fresh next_url from a GET rather than the one stored at creation
const resumeUnfinishedPayment = async (db, payment) => {
  const govPayment = await getGovPayPayment(payment.paymentId)
  const updated = await recordGovPayState(db, payment, govPayment)

  // Past the card page (e.g. authorising) Pay gives no next_url; the return
  // page reports the payment as still in progress
  if (!updated.finished) {
    return nextUrlOf(govPayment) ?? returnUrlFor(payment.returnId)
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
    // A paid payment whose submission failed must be resolved, not paid again
    const paid = await payments(db).findOne({
      applicationId,
      status: PAYMENT_STATUS.SUCCESS
    })
    if (paid) {
      return returnUrlFor(paid.returnId)
    }

    const unfinished = await payments(db).findOne(
      { applicationId, finished: false, paymentId: { $ne: null } },
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
      await payments(db).updateOne(
        { _id: payment._id },
        {
          $set: {
            submissionError: PAYMENT_SUBMISSION_ERROR.LICENCE_NOT_FOUND,
            updatedAt: new Date()
          }
        }
      )
      logger.warn(
        {
          event: {
            action: 'marine_licence_payment_submitted',
            outcome: 'failure',
            reason: PAYMENT_SUBMISSION_ERROR.LICENCE_NOT_FOUND
          }
        },
        `Payment ${payment.paymentId} succeeded but marine licence ${payment.applicationId} no longer exists; refund required`
      )
      throw Boom.notFound('Marine licence not found for payment')
    }

    if (marineLicence.applicationReference) {
      return marineLicence.applicationReference
    }

    const { applicationReference } = await submitMarineLicenceApplication({
      db,
      locker,
      logger,
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
        {
          finished: false,
          paymentId: { $ne: null },
          createdAt: { $lt: olderThan }
        },
        {
          status: PAYMENT_STATUS.SUCCESS,
          applicationReference: null,
          submissionError: null
        }
      ]
    })
    .sort({ createdAt: 1 })
    .limit(limit)
