import { vi } from 'vitest'
import { collectionMarinePlanPolicyWordingSnapshots } from '../../../../shared/common/constants/db-collections.js'
import {
  canonicaliseWording,
  computeWordingRef,
  pinWordingSnapshots
} from './wording-snapshots.js'

describe('wording-snapshots', () => {
  const wording = {
    policy: '<p>statement</p>',
    policyAim: '<p>aim</p>',
    whatIsIt: '<p>what</p>',
    whyIsItImportant: '<p>why</p>',
    howWillThisBeImplemented: '<p>how</p>'
  }

  const buildPolicy = (overrides = {}) => ({
    policyCode: 'E-AGG-1',
    sector: 'Aggregates',
    ...wording,
    ...overrides
  })

  const snapshots = () =>
    global.mockMongo.collection(collectionMarinePlanPolicyWordingSnapshots)

  beforeEach(async () => {
    await snapshots().deleteMany({})
  })

  describe('canonicaliseWording / computeWordingRef', () => {
    it('should produce the same ref for the same wording regardless of key order', () => {
      const reordered = Object.fromEntries(Object.entries(wording).reverse())

      expect(computeWordingRef('E-AGG-1', reordered)).toEqual(
        computeWordingRef('E-AGG-1', wording)
      )
    })

    it('should produce a ref prefixed with the policy code and a 12-char hash', () => {
      const { wordingRef, contentHash } = computeWordingRef('E-AGG-1', wording)

      expect(wordingRef).toBe(`E-AGG-1@${contentHash.slice(0, 12)}`)
      expect(contentHash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should produce different refs for different wording', () => {
      const changed = { ...wording, policy: '<p>amended</p>' }

      expect(computeWordingRef('E-AGG-1', changed).wordingRef).not.toBe(
        computeWordingRef('E-AGG-1', wording).wordingRef
      )
    })

    it('should keep null wording distinct from empty-string wording', () => {
      const withNull = { ...wording, policy: null }
      const withEmpty = { ...wording, policy: '' }

      expect(canonicaliseWording(withNull)).not.toBe(
        canonicaliseWording(withEmpty)
      )
      expect(computeWordingRef('E-AGG-1', withNull).wordingRef).not.toBe(
        computeWordingRef('E-AGG-1', withEmpty).wordingRef
      )
    })

    it('should treat missing fields as null so absent and null wording share a snapshot', () => {
      const { policy, ...withoutPolicy } = wording

      expect(canonicaliseWording(withoutPolicy)).toBe(
        canonicaliseWording({ ...wording, policy: null })
      )
    })
  })

  describe('pinWordingSnapshots', () => {
    it('should return an empty array without touching the database when there are no policies', async () => {
      vi.spyOn(global.mockMongo, 'collection')

      const pinned = await pinWordingSnapshots({
        db: global.mockMongo,
        policies: [],
        now: new Date()
      })

      expect(pinned).toEqual([])
      expect(global.mockMongo.collection).not.toHaveBeenCalled()
    })

    it('should store the wording verbatim once and return pointers only', async () => {
      const now = new Date()

      const pinned = await pinWordingSnapshots({
        db: global.mockMongo,
        policies: [buildPolicy()],
        now
      })

      const { wordingRef, contentHash } = computeWordingRef('E-AGG-1', wording)
      expect(pinned).toEqual([
        { policyCode: 'E-AGG-1', sector: 'Aggregates', wordingRef }
      ])
      const rows = await snapshots().find({}).toArray()
      expect(rows).toEqual([
        {
          _id: wordingRef,
          policyCode: 'E-AGG-1',
          contentHash,
          capturedAt: now,
          ...wording
        }
      ])
    })

    it('should preserve null wording fields verbatim in the snapshot', async () => {
      await pinWordingSnapshots({
        db: global.mockMongo,
        policies: [buildPolicy({ policy: null })],
        now: new Date()
      })

      const [row] = await snapshots().find({}).toArray()
      expect(row.policy).toBeNull()
    })

    it('should never rewrite an existing snapshot (first capture wins)', async () => {
      const firstCapture = new Date('2026-01-01')
      const secondCapture = new Date('2026-06-01')

      await pinWordingSnapshots({
        db: global.mockMongo,
        policies: [buildPolicy()],
        now: firstCapture
      })
      await pinWordingSnapshots({
        db: global.mockMongo,
        policies: [buildPolicy()],
        now: secondCapture
      })

      const rows = await snapshots().find({}).toArray()
      expect(rows).toHaveLength(1)
      expect(rows[0].capturedAt).toEqual(firstCapture)
    })

    it('should keep one row per distinct wording of the same policy', async () => {
      await pinWordingSnapshots({
        db: global.mockMongo,
        policies: [buildPolicy(), buildPolicy({ policy: '<p>amended</p>' })],
        now: new Date()
      })

      const rows = await snapshots().find({ policyCode: 'E-AGG-1' }).toArray()
      expect(rows).toHaveLength(2)
    })

    it('should swallow duplicate-key errors from concurrent upserts', async () => {
      const bulkWrite = vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('duplicate'), { code: 11000 })
        )
      const db = { collection: () => ({ bulkWrite }) }

      const pinned = await pinWordingSnapshots({
        db,
        policies: [buildPolicy()],
        now: new Date()
      })

      expect(pinned).toHaveLength(1)
    })

    it('should swallow bulk write errors made up solely of duplicate-key errors', async () => {
      const bulkWrite = vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('bulk'), { writeErrors: [{ code: 11000 }] })
        )
      const db = { collection: () => ({ bulkWrite }) }

      await expect(
        pinWordingSnapshots({ db, policies: [buildPolicy()], now: new Date() })
      ).resolves.toHaveLength(1)
    })

    it('should rethrow non-duplicate-key errors', async () => {
      const bulkWrite = vi.fn().mockRejectedValue(new Error('network down'))
      const db = { collection: () => ({ bulkWrite }) }

      await expect(
        pinWordingSnapshots({ db, policies: [buildPolicy()], now: new Date() })
      ).rejects.toThrow('network down')
    })
  })
})
