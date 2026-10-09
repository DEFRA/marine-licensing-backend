import { vi } from 'vitest'
import {
  processDynamicsJob,
  processDynamicsDlqJob
} from './worker-processor.js'
import { sendToDynamics } from '../../../../shared/common/helpers/dynamics/dynamics-client.js'
import { getDynamicsAccessToken } from '../../../../shared/common/helpers/dynamics/get-access-token.js'
import { deleteDynamicsJob } from './sqs-client.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import {
  MARINE_LICENCE_DYNAMICS_EVENT_ACTION,
  MARINE_LICENCE_STATUS
} from '../../../constants/marine-licence.js'

vi.mock('./sqs-client.js', () => ({
  deleteDynamicsJob: vi.fn()
}))
vi.mock(
  '../../../../shared/common/helpers/dynamics/dynamics-client.js',
  () => ({
    sendToDynamics: vi.fn()
  })
)
vi.mock(
  '../../../../shared/common/helpers/dynamics/get-access-token.js',
  () => ({
    getDynamicsAccessToken: vi.fn()
  })
)

const applicationReference = 'MLA/2026/00042'
const originalUpdatedAt = new Date('2026-01-01T00:00:00.000Z')

const message = (action, receiveCount = '1') => ({
  Body: JSON.stringify({
    applicationReference,
    action,
    type: 'MARINE_LICENCE'
  }),
  ReceiptHandle: `receipt-${action}`,
  Attributes: { ApproximateReceiveCount: receiveCount }
})

describe('marine licence dynamics worker-processor with real Mongo', () => {
  const licences = () =>
    globalThis.mockMongo.collection(collectionMarineLicences)
  const server = () => ({
    db: globalThis.mockMongo,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })
  const reload = () => licences().findOne({ applicationReference })
  const insertLicence = (overrides = {}) =>
    licences().insertOne({
      applicationReference,
      status: MARINE_LICENCE_STATUS.SUBMITTED,
      updatedAt: originalUpdatedAt,
      updatedBy: 'applicant',
      ...overrides
    })

  beforeEach(() => {
    vi.mocked(getDynamicsAccessToken).mockResolvedValue('token')
    vi.mocked(sendToDynamics).mockResolvedValue({})
    vi.mocked(deleteDynamicsJob).mockResolvedValue({})
  })

  it('should flag a sent submit on the licence and leave updatedAt and status alone', async () => {
    await insertLicence()

    await processDynamicsJob(server(), message('submit'))

    const licence = await reload()
    expect(licence.dynamicsOutbound).toEqual({ submit: 'sent' })
    expect(licence.updatedAt).toEqual(originalUpdatedAt)
    expect(licence.updatedBy).toBe('applicant')
    expect(licence.status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)
  })

  it('should not POST a redelivered submit a second time', async () => {
    await insertLicence()

    await processDynamicsJob(server(), message('submit'))
    await processDynamicsJob(server(), message('submit'))

    expect(sendToDynamics).toHaveBeenCalledTimes(1)
    expect(deleteDynamicsJob).toHaveBeenCalledTimes(2)
  })

  it('should not POST a withdrawal that arrives before its submit is sent', async () => {
    await insertLicence()

    await processDynamicsJob(server(), message('withdraw'))

    expect(sendToDynamics).not.toHaveBeenCalled()
    expect(deleteDynamicsJob).not.toHaveBeenCalled()
    expect((await reload()).dynamicsOutbound).toBeUndefined()
  })

  it('should send a withdrawal once the submit is sent, keeping both flags', async () => {
    await insertLicence()

    await processDynamicsJob(server(), message('submit'))
    await processDynamicsJob(server(), message('withdraw'))

    expect((await reload()).dynamicsOutbound).toEqual({
      submit: 'sent',
      withdraw: 'sent'
    })
  })

  it('should send a withdrawal for a licence whose submit was flagged by the backfill', async () => {
    await insertLicence({ dynamicsOutbound: { submit: 'sent' } })

    await processDynamicsJob(server(), message('withdraw'))

    expect(sendToDynamics).toHaveBeenCalledTimes(1)
    expect((await reload()).dynamicsOutbound.withdraw).toBe('sent')
  })

  it('should not let a dead letter overwrite a sent flag', async () => {
    await insertLicence({ dynamicsOutbound: { submit: 'sent' } })

    await processDynamicsDlqJob(server(), message('submit'))

    expect((await reload()).dynamicsOutbound.submit).toBe('sent')
  })

  it('should log a dead letter as ignored when the licence is already failed', async () => {
    await insertLicence({ dynamicsOutbound: { submit: 'failed' } })
    const dlqServer = server()

    await processDynamicsDlqJob(dlqServer, message('submit'))

    expect(dlqServer.logger.warn).not.toHaveBeenCalled()
    expect(dlqServer.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MARINE_LICENCE_DYNAMICS_EVENT_ACTION.DEAD_LETTER_IGNORED
        })
      }),
      expect.any(String)
    )
  })

  it('should mark a dead-lettered submit failed', async () => {
    await insertLicence()

    await processDynamicsDlqJob(server(), message('submit'))

    expect((await reload()).dynamicsOutbound.submit).toBe('failed')
    expect((await reload()).updatedAt).toEqual(originalUpdatedAt)
  })

  it('should send a submit redriven from the DLQ and replace failed with sent', async () => {
    await insertLicence({ dynamicsOutbound: { submit: 'failed' } })

    await processDynamicsJob(server(), message('submit'))

    expect(sendToDynamics).toHaveBeenCalledTimes(1)
    expect((await reload()).dynamicsOutbound.submit).toBe('sent')
  })

  it('should not POST again when the delete failed after a successful send', async () => {
    await insertLicence()
    vi.mocked(deleteDynamicsJob).mockRejectedValueOnce(new Error('SQS down'))

    await expect(
      processDynamicsJob(server(), message('submit'))
    ).rejects.toThrow('SQS down')
    await processDynamicsJob(server(), message('submit'))

    expect(sendToDynamics).toHaveBeenCalledTimes(1)
    expect((await reload()).dynamicsOutbound.submit).toBe('sent')
  })
})
