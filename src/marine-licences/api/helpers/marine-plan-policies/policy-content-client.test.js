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
      initialDocs: [cachedDoc('E-AGG-1'), cachedDoc('S-AQ-1')]
    })

    const result = await getPoliciesContent({
      policies: [
        { policyCode: 'E-AGG-1', sector: 'Aggregates' },
        { policyCode: 'S-AQ-1', sector: 'Aquaculture' }
      ],
      db: global.mockMongo,
      logger
    })

    expect(mockFind).toHaveBeenCalledTimes(1)
    expect(mockFind).toHaveBeenCalledWith({
      _id: { $in: ['E-AGG-1', 'S-AQ-1'] }
    })
    expect(Wreck.get).not.toHaveBeenCalled()
    expect(mockBulkWrite).not.toHaveBeenCalled()
    expect(result).toEqual([
      expectedMerged('E-AGG-1', { sector: 'Aggregates' }),
      expectedMerged('S-AQ-1', { sector: 'Aquaculture' })
    ])
  })

  it('should refresh the dataset once and re-query missing codes on a cache miss', async () => {
    const { mockFind, mockBulkWrite } = setupMocks({
      initialDocs: [cachedDoc('E-AGG-1')],
      refreshedDocs: [cachedDoc('S-AQ-1')]
    })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [policyEntry('E-AGG-1'), policyEntry('S-AQ-1')]
    })

    const result = await getPoliciesContent({
      policies: [
        { policyCode: 'E-AGG-1', sector: 'Aggregates' },
        { policyCode: 'S-AQ-1', sector: 'Aquaculture' }
      ],
      db: global.mockMongo,
      logger
    })

    expect(mockFind).toHaveBeenCalledTimes(2)
    expect(mockFind).toHaveBeenNthCalledWith(1, {
      _id: { $in: ['E-AGG-1', 'S-AQ-1'] }
    })
    expect(mockFind).toHaveBeenNthCalledWith(2, { _id: { $in: ['S-AQ-1'] } })
    expect(Wreck.get).toHaveBeenCalledTimes(1)
    expect(mockBulkWrite).toHaveBeenCalledTimes(1)
    expect(result).toEqual([
      expectedMerged('E-AGG-1', { sector: 'Aggregates' }),
      expectedMerged('S-AQ-1', { sector: 'Aquaculture' })
    ])
  })

  it('should write not found policy codes in one bulkWrite and return empty wording for codes absent from the dataset', async () => {
    const { mockBulkWrite } = setupMocks({
      initialDocs: [],
      refreshedDocs: []
    })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [policyEntry('E-AGG-1')]
    })

    const result = await getPoliciesContent({
      policies: [{ policyCode: 'X-UNKNOWN-99', sector: 'Unknown' }],
      db: global.mockMongo,
      logger
    })

    expect(result).toEqual([
      { policyCode: 'X-UNKNOWN-99', sector: 'Unknown', ...emptyContent }
    ])
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ outcome: 'failure' })
      }),
      expect.stringContaining('X-UNKNOWN-99')
    )
    expect(mockBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'X-UNKNOWN-99' },
          update: { $set: { notFound: true, fetchedAt: expect.any(Date) } },
          upsert: true
        }
      }
    ])
  })

  it('should return empty wording and log info for codes already cached as notFound', async () => {
    setupMocks({
      initialDocs: [
        { _id: 'X-UNKNOWN-99', notFound: true, fetchedAt: new Date() }
      ]
    })

    const result = await getPoliciesContent({
      policies: [{ policyCode: 'X-UNKNOWN-99', sector: 'Unknown' }],
      db: global.mockMongo,
      logger
    })

    expect(result).toEqual([
      { policyCode: 'X-UNKNOWN-99', sector: 'Unknown', ...emptyContent }
    ])
    expect(Wreck.get).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ outcome: 'success' })
      }),
      expect.stringContaining('X-UNKNOWN-99')
    )
  })

  it('should not match a cached code when the ArcGIS code differs from it in case', async () => {
    const { mockFind, mockBulkWrite } = setupMocks({
      initialDocs: [],
      refreshedDocs: []
    })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [policyEntry('NE-INNS-1')]
    })

    const result = await getPoliciesContent({
      policies: [
        { policyCode: 'ne-inns-1', sector: 'Invasive non-native species' }
      ],
      db: global.mockMongo,
      logger
    })

    expect(mockFind).toHaveBeenCalledWith({ _id: { $in: ['ne-inns-1'] } })
    expect(mockBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'ne-inns-1' },
          update: { $set: { notFound: true, fetchedAt: expect.any(Date) } },
          upsert: true
        }
      }
    ])
    expect(result).toEqual([
      {
        policyCode: 'ne-inns-1',
        sector: 'Invasive non-native species',
        ...emptyContent
      }
    ])
  })

  it('should write the whitespace-stripped code as the cache _id when refreshing the dataset, preserving case and hyphens', async () => {
    const { mockBulkWrite } = setupMocks({
      initialDocs: [],
      refreshedDocs: [cachedDoc('NE-INNS-1')]
    })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [policyEntry('NE- INNS-1')]
    })

    await getPoliciesContent({
      policies: [
        { policyCode: 'NE-INNS-1', sector: 'Invasive non-native species' }
      ],
      db: global.mockMongo,
      logger
    })

    expect(mockBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'NE-INNS-1' },
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
        policies: [{ policyCode: 'E-AGG-1' }],
        db: global.mockMongo,
        logger
      })
    ).rejects.toThrow('GOV.UK policies API returned no policies')
  })

  describe('sanitisation and validation at ingest', () => {
    it('should fetch the dataset with the configured maxBytes cap', async () => {
      setupMocks({ initialDocs: [], refreshedDocs: [cachedDoc('E-AGG-1')] })
      Wreck.get.mockResolvedValue({
        res: { statusCode: 200 },
        payload: [policyEntry('E-AGG-1')]
      })

      await getPoliciesContent({
        policies: [{ policyCode: 'E-AGG-1' }],
        db: global.mockMongo,
        logger
      })

      const [, options] = Wreck.get.mock.calls[0]
      expect(options.maxBytes).toBe(30_000_000)
    })

    it('should sanitise wording fields before caching them', async () => {
      const { mockBulkWrite } = setupMocks({
        initialDocs: [],
        refreshedDocs: [cachedDoc('E-AGG-1')]
      })
      Wreck.get.mockResolvedValue({
        res: { statusCode: 200 },
        payload: [
          policyEntry('E-AGG-1', {
            policy:
              '<p><span style="color: black;">Text</span></p><p><br></p><script>alert(1)</script>'
          })
        ]
      })

      await getPoliciesContent({
        policies: [{ policyCode: 'E-AGG-1' }],
        db: global.mockMongo,
        logger
      })

      const [operations] = mockBulkWrite.mock.calls[0]
      expect(operations[0].updateOne.update.$set.policy).toBe('<p>Text</p>')
    })

    it('should store null and warn when a wording field is not a string', async () => {
      const { mockBulkWrite } = setupMocks({
        initialDocs: [],
        refreshedDocs: [cachedDoc('E-AGG-1')]
      })
      Wreck.get.mockResolvedValue({
        res: { statusCode: 200 },
        payload: [policyEntry('E-AGG-1', { policyAim: 12345 })]
      })

      await getPoliciesContent({
        policies: [{ policyCode: 'E-AGG-1' }],
        db: global.mockMongo,
        logger
      })

      const [operations] = mockBulkWrite.mock.calls[0]
      expect(operations[0].updateOne.update.$set.policyAim).toBeNull()
      expect(logger.warn).toHaveBeenCalledWith(
        {
          event: expect.objectContaining({
            action: 'mp-policies:wording-field-invalid',
            outcome: 'failure',
            reference: 'E-AGG-1/policyAim'
          })
        },
        expect.stringContaining('E-AGG-1')
      )
      expect(operations[0].updateOne.update.$set.policy).toBe(
        '<p>E-AGG-1 policy statement</p>'
      )
    })

    it('should store null without warning when a wording field is null', async () => {
      const { mockBulkWrite } = setupMocks({
        initialDocs: [],
        refreshedDocs: [cachedDoc('E-AGG-1')]
      })
      Wreck.get.mockResolvedValue({
        res: { statusCode: 200 },
        payload: [policyEntry('E-AGG-1', { whatIsIt: null })]
      })

      await getPoliciesContent({
        policies: [{ policyCode: 'E-AGG-1' }],
        db: global.mockMongo,
        logger
      })

      const [operations] = mockBulkWrite.mock.calls[0]
      expect(operations[0].updateOne.update.$set.whatIsIt).toBeNull()
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('should store null and warn when a sanitised wording field exceeds the size cap', async () => {
      const { mockBulkWrite } = setupMocks({
        initialDocs: [],
        refreshedDocs: [cachedDoc('E-AGG-1')]
      })
      Wreck.get.mockResolvedValue({
        res: { statusCode: 200 },
        payload: [
          policyEntry('E-AGG-1', {
            policy: `<p>${'a'.repeat(200_000)}</p>`
          })
        ]
      })

      await getPoliciesContent({
        policies: [{ policyCode: 'E-AGG-1' }],
        db: global.mockMongo,
        logger
      })

      const [operations] = mockBulkWrite.mock.calls[0]
      expect(operations[0].updateOne.update.$set.policy).toBeNull()
      expect(logger.warn).toHaveBeenCalledWith(
        {
          event: expect.objectContaining({
            action: 'mp-policies:wording-field-too-large',
            outcome: 'failure',
            reference: 'E-AGG-1/policy'
          })
        },
        expect.stringContaining('E-AGG-1')
      )
    })

    it('should skip entries with a missing or non-string code without aborting the refresh', async () => {
      const { mockBulkWrite } = setupMocks({
        initialDocs: [],
        refreshedDocs: [cachedDoc('E-AGG-1'), cachedDoc('S-AQ-1')]
      })
      Wreck.get.mockResolvedValue({
        res: { statusCode: 200 },
        payload: [
          policyEntry('E-AGG-1'),
          { code: 12345, policy: '<p>bad</p>' },
          { policy: '<p>no code</p>' },
          policyEntry('S-AQ-1')
        ]
      })

      await getPoliciesContent({
        policies: [
          { policyCode: 'E-AGG-1', sector: 'Aggregates' },
          { policyCode: 'S-AQ-1', sector: 'Aquaculture' }
        ],
        db: global.mockMongo,
        logger
      })

      const [operations] = mockBulkWrite.mock.calls[0]
      expect(operations).toHaveLength(2)
      expect(logger.warn).toHaveBeenCalledWith(
        {
          event: expect.objectContaining({
            action: 'mp-policies:wording-entry-skipped',
            outcome: 'failure'
          })
        },
        expect.any(String)
      )
    })

    it('should throw when every entry in the dataset has an invalid code', async () => {
      setupMocks({ initialDocs: [], refreshedDocs: [] })
      Wreck.get.mockResolvedValue({
        res: { statusCode: 200 },
        payload: [{ code: 12345 }, { policy: '<p>no code</p>' }]
      })

      await expect(
        getPoliciesContent({
          policies: [{ policyCode: 'E-AGG-1' }],
          db: global.mockMongo,
          logger
        })
      ).rejects.toThrow('GOV.UK policies API returned no valid policies')
    })
  })
})
