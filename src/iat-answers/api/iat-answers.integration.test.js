import { setupTestServer } from '../../../tests/test-server.js'
import { collectionIatAnswers } from '../../shared/common/constants/db-collections.js'

/*
 * Cross-repo contract test for the /iat-answers routes.
 *
 * The frontend payload-builder emits the `outcome` object in three distinct
 * shapes depending on the outcome classification (intermediate / terminal-
 * single / terminal-multi). All three shapes use non-empty fallbacks for
 * `typeId` and `summaryText`. This test locks in that each of those shapes
 * round-trips cleanly through the full HTTP lifecycle:
 *
 *   POST   /iat-answers          -> 201 + { id }
 *   GET    /iat-answers/{id}     -> 200 + document (id is string, no _id)
 *   PUT    /iat-answers/{id}     -> 200, createdAt/createdBy preserved
 *   GET    /iat-answers/{id}     -> 200, updated outcome.summaryText
 *   DELETE /iat-answers/{id}     -> 204
 *   GET    /iat-answers/{id}     -> 404
 *
 * It exercises the real Joi schema, real handler logic, and the in-memory
 * MongoDB instance. If Joi were tightened in a way that rejected the three
 * shapes the frontend currently emits, the POST step would return 400 and
 * this test would fail.
 */

// Shape 1 — intermediate outcome with a session-stashed outcomeTypeId.
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

// Shape 2 — terminal-single outcome (one outcomeType, frontend derives typeId from it).
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

// Shape 3 — terminal-multi outcome (no single outcomeType, frontend uses
// outcomeRoute as the typeId sentinel and outcome.heading as summaryText).
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
    // setup-files.js only resets exemptions + marine-licences; clear our
    // collection explicitly so each round-trip starts from an empty state.
    await globalThis.mockMongo.collection(collectionIatAnswers).deleteMany({})
  })

  for (const [label, payload] of cases) {
    test(`round-trips POST -> GET -> PUT -> GET -> DELETE -> GET (404) for ${label}`, async () => {
      const server = getServer()

      // POST: create
      const postRes = await server.inject({
        method: 'POST',
        url: '/iat-answers',
        payload
      })
      expect(postRes.statusCode).toBe(201)
      const postBody = JSON.parse(postRes.payload)
      const id = postBody.value.id
      expect(id).toMatch(/^[0-9a-f]{24}$/)

      // GET: fetch the created doc
      const getRes = await server.inject({
        method: 'GET',
        url: `/iat-answers/${id}`
      })
      expect(getRes.statusCode).toBe(200)
      const getDoc = JSON.parse(getRes.payload).value
      expect(getDoc.id).toBe(id)
      expect(getDoc._id).toBeUndefined()
      expect(getDoc.outcome).toEqual(payload.outcome)
      expect(getDoc.answers).toEqual(payload.answers)
      // Unauthenticated path -> optional contactId is null.
      expect(getDoc.createdBy).toBeNull()
      expect(getDoc.updatedBy).toBeNull()
      expect(typeof getDoc.createdAt).toBe('string')
      expect(typeof getDoc.updatedAt).toBe('string')
      const originalCreatedAt = getDoc.createdAt

      // PUT: replace, mutating summaryText so we can prove the update landed.
      const updatedPayload = {
        ...payload,
        outcome: { ...payload.outcome, summaryText: 'Updated text' }
      }
      const putRes = await server.inject({
        method: 'PUT',
        url: `/iat-answers/${id}`,
        payload: updatedPayload
      })
      expect(putRes.statusCode).toBe(200)

      // GET: verify the PUT and that createdAt/createdBy are preserved.
      const getRes2 = await server.inject({
        method: 'GET',
        url: `/iat-answers/${id}`
      })
      expect(getRes2.statusCode).toBe(200)
      const getDoc2 = JSON.parse(getRes2.payload).value
      expect(getDoc2.id).toBe(id)
      expect(getDoc2.outcome.summaryText).toBe('Updated text')
      expect(getDoc2.outcome.route).toBe(payload.outcome.route)
      expect(getDoc2.outcome.typeId).toBe(payload.outcome.typeId)
      expect(getDoc2.createdAt).toBe(originalCreatedAt)
      expect(getDoc2.createdBy).toBeNull()

      // DELETE: remove the doc.
      const delRes = await server.inject({
        method: 'DELETE',
        url: `/iat-answers/${id}`
      })
      expect(delRes.statusCode).toBe(204)
      expect(delRes.payload).toBe('')

      // GET: now 404.
      const getRes3 = await server.inject({
        method: 'GET',
        url: `/iat-answers/${id}`
      })
      expect(getRes3.statusCode).toBe(404)
    })
  }

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

    // POST: create with malicious content
    const postRes = await server.inject({
      method: 'POST',
      url: '/iat-answers',
      payload: maliciousPayload
    })
    expect(postRes.statusCode).toBe(201)
    const id = JSON.parse(postRes.payload).value.id

    // GET: fetched doc has clean summaryText
    const getRes = await server.inject({
      method: 'GET',
      url: `/iat-answers/${id}`
    })
    expect(getRes.statusCode).toBe(200)
    const doc = JSON.parse(getRes.payload).value
    expect(doc.outcome.summaryText).toBe('<p>ok</p><a>x</a>')
    expect(doc.outcome.summaryText).not.toContain('<script>')
    expect(doc.outcome.summaryText).not.toContain('javascript:')
  })
})
