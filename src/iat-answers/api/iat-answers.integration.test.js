import { setupTestServer } from '../../../tests/test-server.js'
import { collectionIatAnswers } from '../../shared/common/constants/db-collections.js'

/*
 * Cross-repo contract test for the /iat-answers routes.
 *
 * The frontend payload-builder emits the `outcome` object in three distinct
 * shapes (intermediate / terminal-single / terminal-multi). All three shapes
 * use non-empty fallbacks for `typeId` and `summaryText`. This test locks in
 * that each round-trips cleanly:
 *
 *   POST   /iat-answers          -> 201 + { slug }
 *   GET    /iat-answers/{slug}   -> 200 + document (no _id; slug present)
 *
 * Append-only model: there are no PUT or DELETE routes. Repeated POSTs of
 * the same payload mint distinct slugs and leave both documents in place.
 */

const SLUG_PATTERN = /^[A-Za-z0-9_-]{22}$/

const intermediatePayload = {
  outcome: {
    route: '/section-2/intermediate-question',
    typeId: 'option-a',
    summaryText: 'You selected Option A. Continue to the next question.'
  },
  answers: [
    {
      questionRoute: '/first-question',
      questionText: 'What is the activity?',
      answers: [{ id: 'fishing', text: 'Fishing' }]
    },
    {
      questionRoute: '/follow-up',
      questionText: 'What type of fishing?',
      answers: [
        { id: 'commercial', text: 'Commercial fishing' },
        { id: 'recreational', text: 'Recreational fishing' }
      ]
    }
  ]
}

const terminalSinglePayload = {
  outcome: {
    route: '/outcome/not-licensable',
    typeId: 'not-licensable-type',
    summaryText: 'You do not need a marine licence for this activity.'
  },
  answers: [
    {
      questionRoute: '/q1',
      questionText: 'Q1?',
      answers: [{ id: 'a1', text: 'A1' }]
    }
  ]
}

const terminalMultiPayload = {
  outcome: {
    route: '/outcome/scaffolding-impede-navigation',
    typeId: '/outcome/scaffolding-impede-navigation',
    summaryText: 'Scaffolding that may impede navigation'
  },
  answers: [
    {
      questionRoute: '/q1',
      questionText: 'Q1?',
      answers: [{ id: 'a1', text: 'A1' }]
    }
  ]
}

const cases = [
  ['intermediate', intermediatePayload],
  ['terminal-single', terminalSinglePayload],
  ['terminal-multi', terminalMultiPayload]
]

describe('/iat-answers contract — integration tests', async () => {
  const getServer = await setupTestServer()

  beforeEach(async () => {
    await globalThis.mockMongo.collection(collectionIatAnswers).deleteMany({})
  })

  for (const [label, payload] of cases) {
    test(`POST then GET round-trips for ${label}`, async () => {
      const server = getServer()

      const postRes = await server.inject({
        method: 'POST',
        url: '/iat-answers',
        payload
      })
      expect(postRes.statusCode).toBe(201)
      const { slug } = JSON.parse(postRes.payload).value
      expect(slug).toMatch(SLUG_PATTERN)

      const getRes = await server.inject({
        method: 'GET',
        url: `/iat-answers/${slug}`
      })
      expect(getRes.statusCode).toBe(200)
      const doc = JSON.parse(getRes.payload).value
      expect(doc.slug).toBe(slug)
      expect(doc._id).toBeUndefined()
      expect(doc.outcome).toEqual(payload.outcome)
      expect(doc.answers).toEqual(payload.answers)
      expect(doc.createdBy).toBeNull()
      expect(typeof doc.createdAt).toBe('string')
    })
  }

  test('append-only: repeated POST of the same payload mints distinct slugs and both docs survive', async () => {
    const server = getServer()

    const firstRes = await server.inject({
      method: 'POST',
      url: '/iat-answers',
      payload: terminalSinglePayload
    })
    const firstSlug = JSON.parse(firstRes.payload).value.slug

    const secondRes = await server.inject({
      method: 'POST',
      url: '/iat-answers',
      payload: terminalSinglePayload
    })
    const secondSlug = JSON.parse(secondRes.payload).value.slug

    expect(secondSlug).not.toBe(firstSlug)

    for (const slug of [firstSlug, secondSlug]) {
      const getRes = await server.inject({
        method: 'GET',
        url: `/iat-answers/${slug}`
      })
      expect(getRes.statusCode).toBe(200)
    }
  })

  test('GET with a malformed slug returns 400 (Joi)', async () => {
    const server = getServer()
    const res = await server.inject({
      method: 'GET',
      url: '/iat-answers/not-a-valid-slug'
    })
    expect(res.statusCode).toBe(400)
  })

  test('GET with a 24-hex ObjectId-shaped string is rejected by Joi (length 24 ≠ 22)', async () => {
    const server = getServer()
    const res = await server.inject({
      method: 'GET',
      url: '/iat-answers/65a4f3c8b2d1e0a7c4b59f3e'
    })
    expect(res.statusCode).toBe(400)
  })

  test('POST sanitises malicious HTML in outcome.summaryText; GET returns clean data', async () => {
    const server = getServer()

    const maliciousPayload = {
      outcome: {
        route: '/outcome/scaffolding-impede-navigation',
        typeId: '/outcome/scaffolding-impede-navigation',
        summaryText:
          '<p>ok</p>' +
          '<script>alert(1)</script>' +
          '<a href="javascript:alert(1)">x</a>'
      },
      answers: [
        {
          questionRoute: '/q1',
          questionText: 'Q1?',
          answers: [{ id: 'a1', text: 'A1' }]
        }
      ]
    }

    const postRes = await server.inject({
      method: 'POST',
      url: '/iat-answers',
      payload: maliciousPayload
    })
    expect(postRes.statusCode).toBe(201)
    const slug = JSON.parse(postRes.payload).value.slug

    const getRes = await server.inject({
      method: 'GET',
      url: `/iat-answers/${slug}`
    })
    expect(getRes.statusCode).toBe(200)
    const doc = JSON.parse(getRes.payload).value
    expect(doc.outcome.summaryText).not.toContain('<script>')
    expect(doc.outcome.summaryText).not.toContain('javascript:')
  })
})
