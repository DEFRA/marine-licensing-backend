import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../../tests/server-requests.js'
import { mockMarineLicence } from '../../../models/test-fixtures.js'
import { collectionMarinePlanPolicyWordingSnapshots } from '../../../../shared/common/constants/db-collections.js'
import { pinWordingSnapshots } from './wording-snapshots.js'

describe('Wording snapshots pin → hydrate round trip - integration tests', async () => {
  const getServer = await setupTestServer()

  const wording = {
    policy: '<p>statement</p>',
    policyAim: '<p>aim</p>',
    whatIsIt: '<p>what</p>',
    whyIsItImportant: '<p>why</p>',
    howWillThisBeImplemented: '<p>how</p>'
  }
  const policy = { policyCode: 'E-AGG-1', sector: 'Aggregates', ...wording }

  const snapshots = () =>
    globalThis.mockMongo.collection(collectionMarinePlanPolicyWordingSnapshots)

  beforeEach(async () => {
    await snapshots().deleteMany({})
  })

  it('should return an empty array without writing snapshots when there are no policies', async () => {
    const pinned = await pinWordingSnapshots({
      db: getServer().db,
      policies: [],
      now: new Date()
    })

    expect(pinned).toEqual([])
    expect(await snapshots().countDocuments()).toBe(0)
  })

  it('should pin wording once and serve it hydrated from GET /marine-licence/{id}', async () => {
    const db = getServer().db
    const firstCapture = new Date('2026-01-01')

    const pinned = await pinWordingSnapshots({
      db,
      policies: [policy],
      now: firstCapture
    })
    // re-pinning identical wording is idempotent: first capture wins
    await pinWordingSnapshots({ db, policies: [policy], now: new Date() })

    const rows = await snapshots().find({}).toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].capturedAt).toEqual(firstCapture)

    const marineLicenceId = new ObjectId()
    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: marineLicenceId,
      organisation: null,
      marinePlanPolicies: pinned
    })

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}`,
      contactId: mockMarineLicence.contactId
    })

    expect(statusCode).toBe(200)
    expect(body.marinePlanPolicies).toEqual([
      { policyCode: 'E-AGG-1', sector: 'Aggregates', ...wording }
    ])
  })
})
