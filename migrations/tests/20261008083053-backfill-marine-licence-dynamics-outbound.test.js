import { up } from '../20261008083053-backfill-marine-licence-dynamics-outbound.js'
import { collectionMarineLicences } from '../../src/shared/common/constants/db-collections.js'

describe('backfill-marine-licence-dynamics-outbound', () => {
  const legacyQueue = () =>
    global.mockMongo.collection('marine-licence-dynamics-queue')
  const licences = () => global.mockMongo.collection(collectionMarineLicences)
  const updatedAt = new Date('2026-01-01T00:00:00.000Z')

  const queueRow = (applicationReferenceNumber, action, status) => ({
    type: 'MARINE_LICENCE',
    applicationReferenceNumber,
    action,
    status,
    retries: 0
  })
  const outboundFor = async (applicationReference) =>
    (await licences().findOne({ applicationReference })).dynamicsOutbound

  beforeEach(async () => {
    await legacyQueue().deleteMany({})
    await licences().insertMany([
      { applicationReference: 'MLA/2026/00001', updatedAt },
      { applicationReference: 'MLA/2026/00002', updatedAt },
      { applicationReference: 'MLA/2026/00003', updatedAt }
    ])
    await legacyQueue().insertMany([
      queueRow('MLA/2026/00001', 'submit', 'success'),
      queueRow('MLA/2026/00001', 'withdraw', 'success'),
      queueRow('MLA/2026/00002', 'submit', 'success'),
      queueRow('MLA/2026/00003', 'submit', 'failed'),
      queueRow('MLA/2026/99999', 'submit', 'success')
    ])
  })

  it('should flag each action the legacy queue sent successfully', async () => {
    await up(global.mockMongo)

    expect(await outboundFor('MLA/2026/00001')).toEqual({
      submit: 'sent',
      withdraw: 'sent'
    })
    expect(await outboundFor('MLA/2026/00002')).toEqual({ submit: 'sent' })
  })

  it('should not flag an action that never succeeded', async () => {
    await up(global.mockMongo)

    expect(await outboundFor('MLA/2026/00003')).toBeUndefined()
  })

  it('should leave updatedAt untouched', async () => {
    await up(global.mockMongo)

    const licence = await licences().findOne({
      applicationReference: 'MLA/2026/00001'
    })
    expect(licence.updatedAt).toEqual(updatedAt)
  })
})
