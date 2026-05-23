import { setupTestServer } from '../../../tests/test-server.js'
import { collectionIatAnswers } from '../../shared/common/constants/db-collections.js'

/*
 * Integration tests for the /iat-answers routes, covering the full
 * lifecycle introduced in ML-1306:
 *
 *   POST   /iat-answers               -> 201, slug minted server-side
 *   PATCH  /iat-answers/{slug}        -> 200, updates answers (published: false only)
 *   POST   /iat-answers/{slug}/publish -> 200, sets published: true, removes expiresAt
 *   GET    /iat-answers/{slug}        -> 200, returns doc sans _id
 *
 * NOTE: The TTL index test is omitted here because global.mockMongo (in-memory
 * Mongo via vitest-mongodb) does not run migrate-mongo migrations automatically.
 * The production migration (20260523083819-iat-answers-ttl-index.js) creates the
 * index in real environments, and the unit-level controller test confirms the
 * config value is read correctly. The gap is documented here for completeness.
 */

const SLUG_PATTERN = /^[A-Za-z0-9_-]{22}$/

const sampleAnswers = [
  {
    type: 'question',
    questionRoute: '/activity-type',
    answerIds: ['CON']
  }
]

const updatedAnswers = [
  {
    type: 'question',
    questionRoute: '/activity-type',
    answerIds: ['CON']
  },
  {
    type: 'outcome',
    outcomeRoute: '/outcome/not-licensable',
    outcomeTypeId: 'WO_NOT_LICENSABLE'
  }
]

describe('/iat-answers lifecycle — integration tests', async () => {
  const getServer = await setupTestServer()

  beforeEach(async () => {
    await globalThis.mockMongo.collection(collectionIatAnswers).deleteMany({})
  })

  // ── Create ────────────────────────────────────────────────────────────────

  describe('POST /iat-answers', () => {
    it('returns 201 with a slug matching the 22-char base64url pattern', async () => {
      const server = getServer()
      const res = await server.inject({ method: 'POST', url: '/iat-answers' })

      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.payload)
      expect(body.message).toBe('success')
      expect(body.value.slug).toMatch(SLUG_PATTERN)
    })

    it('persists the doc with published: false, a future expiresAt, and an empty answers array', async () => {
      const server = getServer()
      const res = await server.inject({ method: 'POST', url: '/iat-answers' })
      const { slug } = JSON.parse(res.payload).value

      const doc = await globalThis.mockMongo
        .collection(collectionIatAnswers)
        .findOne({ slug })

      expect(doc).not.toBeNull()
      expect(doc.published).toBe(false)
      expect(doc.answers).toEqual([])
      expect(doc.expiresAt).toBeInstanceOf(Date)
      expect(doc.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })
  })

  // ── Patch ────────────────────────────────────────────────────────────────

  describe('PATCH /iat-answers/{slug}', () => {
    let slug

    beforeEach(async () => {
      const server = getServer()
      const res = await server.inject({ method: 'POST', url: '/iat-answers' })
      slug = JSON.parse(res.payload).value.slug
    })

    it('returns 200 and updates the answers array in the db', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'PATCH',
        url: `/iat-answers/${slug}`,
        payload: { answers: sampleAnswers }
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.payload).message).toBe('success')

      const doc = await globalThis.mockMongo
        .collection(collectionIatAnswers)
        .findOne({ slug })
      expect(doc.answers).toEqual(sampleAnswers)
    })

    it('accepts an outcome-type entry as well as a question-type entry', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'PATCH',
        url: `/iat-answers/${slug}`,
        payload: { answers: updatedAnswers }
      })

      expect(res.statusCode).toBe(200)

      const doc = await globalThis.mockMongo
        .collection(collectionIatAnswers)
        .findOne({ slug })
      expect(doc.answers).toEqual(updatedAnswers)
    })

    it('returns 400 when slug param fails Joi pattern validation', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'PATCH',
        url: '/iat-answers/not-a-valid-slug',
        payload: { answers: sampleAnswers }
      })

      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for an unknown slug', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'PATCH',
        url: '/iat-answers/UnknownSlugXXXXXXXXXXX',
        payload: { answers: sampleAnswers }
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── Publish ───────────────────────────────────────────────────────────────

  describe('POST /iat-answers/{slug}/publish', () => {
    let slug

    beforeEach(async () => {
      const server = getServer()
      const createRes = await server.inject({
        method: 'POST',
        url: '/iat-answers'
      })
      slug = JSON.parse(createRes.payload).value.slug

      await server.inject({
        method: 'PATCH',
        url: `/iat-answers/${slug}`,
        payload: { answers: sampleAnswers }
      })
    })

    it('returns 200 on successful publish', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'POST',
        url: `/iat-answers/${slug}/publish`
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.payload).message).toBe('success')
    })

    it('sets published: true and removes expiresAt from the persisted doc', async () => {
      const server = getServer()
      await server.inject({
        method: 'POST',
        url: `/iat-answers/${slug}/publish`
      })

      const doc = await globalThis.mockMongo
        .collection(collectionIatAnswers)
        .findOne({ slug })

      expect(doc.published).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(doc, 'expiresAt')).toBe(false)
    })

    it('returns 404 for an unknown slug', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'POST',
        url: '/iat-answers/UnknownSlugXXXXXXXXXXX/publish'
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── Post-publish PATCH rejection ──────────────────────────────────────────

  describe('PATCH after publish', () => {
    let slug

    beforeEach(async () => {
      const server = getServer()

      const createRes = await server.inject({
        method: 'POST',
        url: '/iat-answers'
      })
      slug = JSON.parse(createRes.payload).value.slug

      await server.inject({
        method: 'PATCH',
        url: `/iat-answers/${slug}`,
        payload: { answers: sampleAnswers }
      })

      await server.inject({
        method: 'POST',
        url: `/iat-answers/${slug}/publish`
      })
    })

    it('returns 404 when attempting to PATCH a published doc', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'PATCH',
        url: `/iat-answers/${slug}`,
        payload: { answers: updatedAnswers }
      })

      expect(res.statusCode).toBe(404)
    })

    it('leaves the published doc unchanged after a rejected PATCH', async () => {
      const server = getServer()
      await server.inject({
        method: 'PATCH',
        url: `/iat-answers/${slug}`,
        payload: { answers: updatedAnswers }
      })

      const doc = await globalThis.mockMongo
        .collection(collectionIatAnswers)
        .findOne({ slug })

      expect(doc.answers).toEqual(sampleAnswers)
      expect(doc.published).toBe(true)
    })
  })

  // ── GET ───────────────────────────────────────────────────────────────────

  describe('GET /iat-answers/{slug}', () => {
    let slug

    beforeEach(async () => {
      const server = getServer()

      const createRes = await server.inject({
        method: 'POST',
        url: '/iat-answers'
      })
      slug = JSON.parse(createRes.payload).value.slug

      await server.inject({
        method: 'PATCH',
        url: `/iat-answers/${slug}`,
        payload: { answers: sampleAnswers }
      })

      await server.inject({
        method: 'POST',
        url: `/iat-answers/${slug}/publish`
      })
    })

    it('returns 200 with the doc body including slug, answers, published and createdAt', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'GET',
        url: `/iat-answers/${slug}`
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      const doc = body.value

      expect(doc.slug).toBe(slug)
      expect(doc.answers).toEqual(sampleAnswers)
      expect(doc.published).toBe(true)
      expect(typeof doc.createdAt).toBe('string')
    })

    it('does not expose _id in the response', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'GET',
        url: `/iat-answers/${slug}`
      })

      const doc = JSON.parse(res.payload).value
      expect(doc._id).toBeUndefined()
    })

    it('returns 404 for an unknown slug', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'GET',
        url: '/iat-answers/UnknownSlugXXXXXXXXXXX'
      })

      expect(res.statusCode).toBe(404)
    })

    it('returns 400 when slug param fails Joi pattern validation', async () => {
      const server = getServer()
      const res = await server.inject({
        method: 'GET',
        url: '/iat-answers/not-a-valid-slug'
      })

      expect(res.statusCode).toBe(400)
    })
  })
})
