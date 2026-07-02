import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { getPoliciesContent } from './policy-content-client.js'

vi.mock('@hapi/wreck')

describe('getPoliciesContent', () => {
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() }

  const policyEntry = (code, overrides = {}) => ({
    _id: 'mongo-id',
    code,
    title: code,
    sector: 'Aggregates (31)',
    policy: `<p>${code} policy statement</p>`,
    policyAim: `<p>${code} aim</p>`,
    whatIsIt: `<p>${code} what</p>`,
    whyIsItImportant: `<p>${code} why</p>`,
    howWillThisBeImplemented: `<p>${code} how</p>`,
    ...overrides
  })

  const cachedDoc = (code) => ({
    _id: code,
    policy: `<p>${code} policy statement</p>`,
    policyAim: `<p>${code} aim</p>`,
    whatIsIt: `<p>${code} what</p>`,
    whyIsItImportant: `<p>${code} why</p>`,
    howWillThisBeImplemented: `<p>${code} how</p>`
  })

  const expectedMerged = (code, extra = {}) => ({
    policyCode: code,
    ...extra,
    policy: `<p>${code} policy statement</p>`,
    policyAim: `<p>${code} aim</p>`,
    whatIsIt: `<p>${code} what</p>`,
    whyIsItImportant: `<p>${code} why</p>`,
    howWillThisBeImplemented: `<p>${code} how</p>`
  })

  const emptyContent = {
    policy: '',
    policyAim: '',
    whatIsIt: '',
    whyIsItImportant: '',
    howWillThisBeImplemented: ''
  }

  const setupMocks = ({ initialDocs = [], refreshedDocs = [] } = {}) => {
    const { mockMongo } = global
    const mockToArray = vi
      .fn()
      .mockResolvedValueOnce(initialDocs)
      .mockResolvedValueOnce(refreshedDocs)
    const mockFind = vi.fn().mockReturnValue({ toArray: mockToArray })
    const mockBulkWrite = vi.fn().mockResolvedValue({})
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
      find: mockFind,
      bulkWrite: mockBulkWrite
    }))
    return { mockFind, mockToArray, mockBulkWrite }
  }

  it('should return an empty array immediately without touching the database', async () => {
    const { mockMongo } = global
    vi.spyOn(mockMongo, 'collection')

    const result = await getPoliciesContent({
      policies: [],
      db: mockMongo,
      logger
    })

    expect(result).toEqual([])
    expect(mockMongo.collection).not.toHaveBeenCalled()
  })

  it('should return merged results in one query when all codes are cached', async () => {
    const { mockFind, mockBulkWrite } = setupMocks({
      initialDocs: [cachedDoc('EAGG1'), cachedDoc('SEAQ1')]
    })

    const result = await getPoliciesContent({
      policies: [
        { policyCode: 'EAGG1', sector: 'Aggregates' },
        { policyCode: 'SEAQ1', sector: 'Aquaculture' }
      ],
      db: global.mockMongo,
      logger
    })

    expect(mockFind).toHaveBeenCalledTimes(1)
    expect(mockFind).toHaveBeenCalledWith({
      _id: { $in: ['EAGG1', 'SEAQ1'] }
    })
    expect(Wreck.get).not.toHaveBeenCalled()
    expect(mockBulkWrite).not.toHaveBeenCalled()
    expect(result).toEqual([
      expectedMerged('EAGG1', { sector: 'Aggregates' }),
      expectedMerged('SEAQ1', { sector: 'Aquaculture' })
    ])
  })

  it('should refresh the dataset once and re-query missing codes on a cache miss', async () => {
    const { mockFind, mockBulkWrite } = setupMocks({
      initialDocs: [cachedDoc('EAGG1')],
      refreshedDocs: [cachedDoc('SEAQ1')]
    })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [policyEntry('EAGG1'), policyEntry('SEAQ1')]
    })

    const result = await getPoliciesContent({
      policies: [
        { policyCode: 'EAGG1', sector: 'Aggregates' },
        { policyCode: 'SEAQ1', sector: 'Aquaculture' }
      ],
      db: global.mockMongo,
      logger
    })

    expect(mockFind).toHaveBeenCalledTimes(2)
    expect(mockFind).toHaveBeenNthCalledWith(1, {
      _id: { $in: ['EAGG1', 'SEAQ1'] }
    })
    expect(mockFind).toHaveBeenNthCalledWith(2, { _id: { $in: ['SEAQ1'] } })
    expect(Wreck.get).toHaveBeenCalledTimes(1)
    expect(mockBulkWrite).toHaveBeenCalledTimes(1)
    expect(result).toEqual([
      expectedMerged('EAGG1', { sector: 'Aggregates' }),
      expectedMerged('SEAQ1', { sector: 'Aquaculture' })
    ])
  })

  it('should write not found policy codes in one bulkWrite and return empty wording for codes absent from the dataset', async () => {
    const { mockBulkWrite } = setupMocks({
      initialDocs: [],
      refreshedDocs: []
    })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [policyEntry('OTHER1')]
    })

    const result = await getPoliciesContent({
      policies: [{ policyCode: 'EAGG99', sector: 'Unknown' }],
      db: global.mockMongo,
      logger
    })

    expect(result).toEqual([
      { policyCode: 'EAGG99', sector: 'Unknown', ...emptyContent }
    ])
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ outcome: 'failure' })
      }),
      expect.stringContaining('EAGG99')
    )
    expect(mockBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'EAGG99' },
          update: { $set: { notFound: true, fetchedAt: expect.any(Date) } },
          upsert: true
        }
      }
    ])
  })

  it('should return empty wording and log info for codes already cached as notFound', async () => {
    setupMocks({
      initialDocs: [{ _id: 'EAGG99', notFound: true, fetchedAt: new Date() }]
    })

    const result = await getPoliciesContent({
      policies: [{ policyCode: 'EAGG99', sector: 'Unknown' }],
      db: global.mockMongo,
      logger
    })

    expect(result).toEqual([
      { policyCode: 'EAGG99', sector: 'Unknown', ...emptyContent }
    ])
    expect(Wreck.get).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ outcome: 'success' })
      }),
      expect.stringContaining('EAGG99')
    )
  })

  it('should match a cached code even when the ArcGIS code differs in spacing, hyphenation and case', async () => {
    const { mockFind } = setupMocks({
      initialDocs: [cachedDoc('EAGG1')]
    })

    const result = await getPoliciesContent({
      policies: [{ policyCode: 'e agg-1', sector: 'Aggregates' }],
      db: global.mockMongo,
      logger
    })

    expect(mockFind).toHaveBeenCalledWith({ _id: { $in: ['EAGG1'] } })
    expect(result).toEqual([
      {
        ...expectedMerged('EAGG1'),
        policyCode: 'e agg-1',
        sector: 'Aggregates'
      }
    ])
  })

  it('should write the normalised code as the cache _id when refreshing the dataset', async () => {
    const { mockBulkWrite } = setupMocks({
      initialDocs: [],
      refreshedDocs: [cachedDoc('EAGG1')]
    })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [policyEntry('e agg-1')]
    })

    await getPoliciesContent({
      policies: [{ policyCode: 'E-AGG-1', sector: 'Aggregates' }],
      db: global.mockMongo,
      logger
    })

    expect(mockBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'EAGG1' },
          update: expect.objectContaining({ $set: expect.any(Object) }),
          upsert: true
        }
      }
    ])
  })

  it('should throw when the GOV.UK API does not return an array', async () => {
    setupMocks({ initialDocs: [], refreshedDocs: [] })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: { message: 'oops' }
    })

    await expect(
      getPoliciesContent({
        policies: [{ policyCode: 'EAGG1' }],
        db: global.mockMongo,
        logger
      })
    ).rejects.toThrow('GOV.UK policies API returned no policies')
  })
})
