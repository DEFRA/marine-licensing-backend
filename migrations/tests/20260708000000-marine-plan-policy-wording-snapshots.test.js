import { ObjectId } from 'mongodb'
import {
  up,
  down
} from '../20260708000000-marine-plan-policy-wording-snapshots.js'
import {
  collectionMarineLicences,
  collectionMarinePlanPolicyWordingSnapshots
} from '../../src/shared/common/constants/db-collections.js'
import { computeWordingRef } from '../../src/marine-licences/api/helpers/marine-plan-policies/wording-snapshots.js'

describe('20260708000000-marine-plan-policy-wording-snapshots', () => {
  const wording = (code, overrides = {}) => ({
    policy: `<p>${code} statement</p>`,
    policyAim: `<p>${code} aim</p>`,
    whatIsIt: `<p>${code} what</p>`,
    whyIsItImportant: null,
    howWillThisBeImplemented: `<p>${code} how</p>`,
    ...overrides
  })

  const embeddedPolicy = (code, overrides = {}) => ({
    policyCode: code,
    sector: 'Aggregates',
    ...wording(code, overrides)
  })

  const licences = () => global.mockMongo.collection(collectionMarineLicences)
  const snapshots = () =>
    global.mockMongo.collection(collectionMarinePlanPolicyWordingSnapshots)

  beforeEach(async () => {
    await snapshots().deleteMany({})
  })

  it('should replace embedded wording with pointers, dedup shared wording, and preserve it byte-for-byte through down()', async () => {
    const updatedAt = new Date('2026-06-01')
    const licenceA = {
      _id: new ObjectId(),
      updatedAt,
      marinePlanPolicies: [
        embeddedPolicy('E-AGG-1'),
        embeddedPolicy('S-FISH-1')
      ]
    }
    // shares E-AGG-1 wording with licence A → must share one snapshot row
    const licenceB = {
      _id: new ObjectId(),
      marinePlanPolicies: [embeddedPolicy('E-AGG-1')]
    }
    await licences().insertMany([licenceA, licenceB])

    await up(global.mockMongo)

    const { wordingRef } = computeWordingRef('E-AGG-1', wording('E-AGG-1'))
    const migratedA = await licences().findOne({ _id: licenceA._id })
    expect(migratedA.marinePlanPolicies[0]).toEqual({
      policyCode: 'E-AGG-1',
      sector: 'Aggregates',
      wordingRef
    })
    expect(migratedA.marinePlanPolicies[1].wordingRef).toBeDefined()
    expect(migratedA.marinePlanPolicies[1].policy).toBeUndefined()

    const rows = await snapshots().find({}).toArray()
    expect(rows).toHaveLength(2) // E-AGG-1 shared between licences + S-FISH-1
    const aggRow = rows.find((r) => r._id === wordingRef)
    expect(aggRow).toMatchObject(wording('E-AGG-1'))
    expect(aggRow.capturedAt).toEqual(updatedAt)

    await down(global.mockMongo)

    const rehydratedA = await licences().findOne({ _id: licenceA._id })
    expect(rehydratedA.marinePlanPolicies).toEqual(licenceA.marinePlanPolicies)
    // the legal record survives down()
    expect(await snapshots().countDocuments()).toBe(2)
  })

  it('should be idempotent and leave already-migrated pointers untouched on re-run', async () => {
    const licence = {
      _id: new ObjectId(),
      marinePlanPolicies: [embeddedPolicy('E-AGG-1')]
    }
    await licences().insertOne(licence)

    await up(global.mockMongo)
    const firstRun = await licences().findOne({ _id: licence._id })
    const firstRow = await snapshots().findOne({})

    await up(global.mockMongo)

    const secondRun = await licences().findOne({ _id: licence._id })
    expect(secondRun.marinePlanPolicies).toEqual(firstRun.marinePlanPolicies)
    const rows = await snapshots().find({}).toArray()
    expect(rows).toEqual([firstRow])
  })

  it('should skip licences with no policies and those already fully migrated', async () => {
    const untouched = { _id: new ObjectId(), marinePlanPolicies: [] }
    const pointerOnly = {
      _id: new ObjectId(),
      marinePlanPolicies: [
        {
          policyCode: 'E-AGG-1',
          sector: 'Aggregates',
          wordingRef: 'E-AGG-1@abc'
        }
      ]
    }
    await licences().insertMany([untouched, pointerOnly])

    await up(global.mockMongo)

    expect(await snapshots().countDocuments()).toBe(0)
    const after = await licences().findOne({ _id: pointerOnly._id })
    expect(after.marinePlanPolicies).toEqual(pointerOnly.marinePlanPolicies)
  })
})
