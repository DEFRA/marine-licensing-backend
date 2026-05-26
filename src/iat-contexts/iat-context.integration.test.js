import { beforeEach } from 'vitest'
import { setupTestServer } from '../../tests/test-server.js'

describe('iat-contexts + iat-outcome-documents lifecycle (integration)', async () => {
  const getServer = await setupTestServer()

  beforeEach(async () => {
    await globalThis.mockMongo.collection('iat-contexts').deleteMany({})
    await globalThis.mockMongo
      .collection('iat-outcome-documents')
      .deleteMany({})
  })

  const inject = (method, url, payload) =>
    getServer().inject({ method, url, payload })

  const post = (url, payload) => inject('POST', url, payload)
  const patch = (url, payload) => inject('PATCH', url, payload)
  const get = (url) => inject('GET', url)

  const answer = (
    questionRoute,
    answerId,
    answerText,
    mcmsAppFormMapping = null
  ) => ({
    answer: {
      questionRoute,
      questionText: questionRoute.replace('/', ''),
      answers: [{ id: answerId, text: answerText }],
      mcmsAppFormMapping
    }
  })

  const mintBody = (focusedId) => ({
    outcomeRoute: '/outcome-a',
    outcomeKind: 'terminal-single',
    outcomeHeading: 'h',
    outcomeText: '',
    focusedOption: {
      id: focusedId,
      heading: focusedId,
      text: '<p>x</p>',
      module: null,
      link: null,
      overrideCtaButtonUrl: null,
      params: null
    }
  })

  test('back-track produces independent immutable snapshots (AC#3 + AC#6 centerpiece)', async () => {
    // 1-4: create + 3 answers + mint snap1
    const create = await post('/iat-contexts')
    expect(create.statusCode).toBe(201)
    const ctxSlug = JSON.parse(create.payload).value.slug

    await patch(`/iat-contexts/${ctxSlug}`, answer('/q1', 'A', 'A'))
    await patch(`/iat-contexts/${ctxSlug}`, answer('/q2', 'B', 'B'))
    await patch(`/iat-contexts/${ctxSlug}`, answer('/q3', 'C', 'C'))

    const mint1 = await post(
      `/iat-contexts/${ctxSlug}/outcome-documents`,
      mintBody('WO_FOO')
    )
    expect(mint1.statusCode).toBe(201)
    const snap1 = JSON.parse(mint1.payload).value.slug

    // 6: GET snap1 returns Q1-Q3
    const snap1Read = await get(`/outcome-documents/${snap1}`)
    expect(snap1Read.statusCode).toBe(200)
    const snap1FirstRead = JSON.parse(snap1Read.payload).value
    expect(snap1FirstRead.questionLog).toHaveLength(3)
    expect(snap1FirstRead.questionLog[1].answers[0].id).toBe('B')

    // 7-8: back-track to Q2 with new answer, then Q3 again
    await patch(`/iat-contexts/${ctxSlug}`, answer('/q2', 'B2', 'B prime'))
    await patch(`/iat-contexts/${ctxSlug}`, answer('/q3', 'C2', 'C two'))

    // 9: mint snap2
    const mint2 = await post(
      `/iat-contexts/${ctxSlug}/outcome-documents`,
      mintBody('WO_BAR')
    )
    expect(mint2.statusCode).toBe(201)
    const snap2 = JSON.parse(mint2.payload).value.slug

    // 10 — CENTERPIECE: snap1 STILL returns Q1-Q3 with B (not B2)
    const snap1ReadAgain = await get(`/outcome-documents/${snap1}`)
    const snap1Doc = JSON.parse(snap1ReadAgain.payload).value
    expect(snap1Doc.questionLog).toHaveLength(3)
    expect(snap1Doc.questionLog[1].answers[0].id).toBe('B') // not B2
    expect(snap1Doc.questionLog[2].answers[0].id).toBe('C') // not C2
    expect(snap1Doc.focusedOption.id).toBe('WO_FOO')

    // 11: snap2 returns the back-tracked path
    const snap2Read = await get(`/outcome-documents/${snap2}`)
    const snap2Doc = JSON.parse(snap2Read.payload).value
    expect(snap2Doc.questionLog).toHaveLength(3)
    expect(snap2Doc.questionLog[1].answers[0].id).toBe('B2')
    expect(snap2Doc.questionLog[2].answers[0].id).toBe('C2')
    expect(snap2Doc.focusedOption.id).toBe('WO_BAR')

    // 12: two distinct snapshot docs exist for the same context
    const allSnaps = await globalThis.mockMongo
      .collection('iat-outcome-documents')
      .find({ contextSlug: ctxSlug })
      .toArray()
    expect(allSnaps).toHaveLength(2)
  })

  test('TTL + unique indexes exist on both collections', async () => {
    const ctxIdx = await globalThis.mockMongo
      .collection('iat-contexts')
      .indexes()
    const docIdx = await globalThis.mockMongo
      .collection('iat-outcome-documents')
      .indexes()

    expect(ctxIdx.some((i) => i.key.slug === 1 && i.unique)).toBe(true)
    expect(
      ctxIdx.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)
    ).toBe(true)
    expect(docIdx.some((i) => i.key.slug === 1 && i.unique)).toBe(true)
    expect(docIdx.some((i) => i.key.contextSlug === 1)).toBe(true)
  })

  test('mint 404s when context slug is unknown', async () => {
    const unknownSlug = 'z'.repeat(22)
    const r = await post(
      `/iat-contexts/${unknownSlug}/outcome-documents`,
      mintBody('WO_X')
    )
    expect(r.statusCode).toBe(404)
  })

  test('GET outcome-document 404s when slug unknown', async () => {
    const unknownSlug = 'y'.repeat(22)
    const r = await get(`/outcome-documents/${unknownSlug}`)
    expect(r.statusCode).toBe(404)
  })
})
