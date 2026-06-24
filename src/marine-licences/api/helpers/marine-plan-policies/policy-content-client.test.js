import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { getPolicyContent } from './policy-content-client.js'

vi.mock('@hapi/wreck')

describe('getPolicyContent', () => {
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

  const expectedContent = (code) => ({
    policy: `<p>${code} policy statement</p>`,
    policyAim: `<p>${code} aim</p>`,
    whatIsIt: `<p>${code} what</p>`,
    whyIsItImportant: `<p>${code} why</p>`,
    howWillThisBeImplemented: `<p>${code} how</p>`
  })

  const setupMocks = ({ cached = null, refreshed = null } = {}) => {
    const { mockMongo } = global
    const mockFindOne = vi
      .fn()
      .mockResolvedValueOnce(cached)
      .mockResolvedValueOnce(refreshed)
    const mockBulkWrite = vi.fn().mockResolvedValue({})
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => ({
      findOne: mockFindOne,
      bulkWrite: mockBulkWrite
    }))
    return { mockFindOne, mockBulkWrite }
  }

  it('should return cached content without calling the GOV.UK API', async () => {
    const { mockBulkWrite } = setupMocks({
      cached: { _id: 'E-AGG-1', ...expectedContent('E-AGG-1') }
    })

    const content = await getPolicyContent({
      policyCode: 'E-AGG-1',
      db: global.mockMongo,
      logger
    })

    expect(content).toEqual(expectedContent('E-AGG-1'))
    expect(Wreck.get).not.toHaveBeenCalled()
    expect(mockBulkWrite).not.toHaveBeenCalled()
  })

  it('should fetch the whole dataset, upsert every policy, and return the requested code on a cache miss', async () => {
    const { mockBulkWrite } = setupMocks({
      refreshed: { _id: 'E-AGG-1', ...expectedContent('E-AGG-1') }
    })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [policyEntry('E-AGG-1'), policyEntry('SE-AQ-1')]
    })

    const content = await getPolicyContent({
      policyCode: 'E-AGG-1',
      db: global.mockMongo,
      logger
    })

    expect(content).toEqual(expectedContent('E-AGG-1'))
    expect(global.mockMongo.collection).toHaveBeenCalledWith(
      'marine-plan-policy-wording'
    )
    expect(mockBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'E-AGG-1' },
          update: {
            $set: { ...expectedContent('E-AGG-1'), fetchedAt: expect.any(Date) }
          },
          upsert: true
        }
      },
      {
        updateOne: {
          filter: { _id: 'SE-AQ-1' },
          update: {
            $set: { ...expectedContent('SE-AQ-1'), fetchedAt: expect.any(Date) }
          },
          upsert: true
        }
      }
    ])
  })

  it('should skip dataset entries without a code and store missing fields as null', async () => {
    const { mockBulkWrite } = setupMocks({
      refreshed: { _id: 'E-AGG-1' }
    })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [
        { title: 'no code here' },
        { code: 'E-AGG-1', policy: '<p>only policy</p>' }
      ]
    })

    await getPolicyContent({
      policyCode: 'E-AGG-1',
      db: global.mockMongo,
      logger
    })

    expect(mockBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'E-AGG-1' },
          update: {
            $set: {
              policy: '<p>only policy</p>',
              policyAim: null,
              whatIsIt: null,
              whyIsItImportant: null,
              howWillThisBeImplemented: null,
              fetchedAt: expect.any(Date)
            }
          },
          upsert: true
        }
      }
    ])
  })

  it('should throw when the API does not return an array', async () => {
    setupMocks()
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: { message: 'oops' }
    })

    await expect(
      getPolicyContent({
        policyCode: 'E-AGG-1',
        db: global.mockMongo,
        logger
      })
    ).rejects.toThrow('GOV.UK policies API returned no policies')
  })

  it('should log a warning and return blank wording when the requested code is missing from the dataset', async () => {
    setupMocks({ refreshed: null })
    Wreck.get.mockResolvedValue({
      res: { statusCode: 200 },
      payload: [policyEntry('SE-AQ-1')]
    })

    const content = await getPolicyContent({
      policyCode: 'E-AGG-99',
      db: global.mockMongo,
      logger
    })

    expect(content).toEqual({
      policy: '',
      policyAim: '',
      whatIsIt: '',
      whyIsItImportant: '',
      howWillThisBeImplemented: ''
    })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ outcome: 'failure' })
      }),
      expect.stringContaining('E-AGG-99')
    )
  })
})
