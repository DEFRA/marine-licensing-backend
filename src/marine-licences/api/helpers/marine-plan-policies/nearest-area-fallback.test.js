import { vi } from 'vitest'
import {
  shouldRunNearestAreaFallback,
  runNearestAreaFallback
} from './nearest-area-fallback.js'
import { findNearestMarinePlanArea } from './nearest-marine-plan-area.js'
import { queryNonSpatialPolicies } from './arcgis-client.js'

vi.mock('./nearest-marine-plan-area.js')
vi.mock('./arcgis-client.js', async (importOriginal) => ({
  ...(await importOriginal()),
  queryNonSpatialPolicies: vi.fn()
}))

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const site = (n) => ({ siteName: `site ${n}` })

describe('shouldRunNearestAreaFallback', () => {
  it('should trigger on an empty policy list', () => {
    expect(shouldRunNearestAreaFallback([])).toBe(true)
  })

  it('should trigger when every policy is Land', () => {
    expect(shouldRunNearestAreaFallback([{ policyCode: 'Land' }])).toBe(true)
  })

  it('should not trigger when Land co-occurs with real policies', () => {
    expect(
      shouldRunNearestAreaFallback([
        { policyCode: 'Land' },
        { policyCode: 'E-BIO-1' }
      ])
    ).toBe(false)
  })

  it('should not trigger on a normal result', () => {
    expect(shouldRunNearestAreaFallback([{ policyCode: 'E-BIO-1' }])).toBe(
      false
    )
  })
})

describe('runNearestAreaFallback', () => {
  const nonSpatial = [
    { policyCode: 'NE-BIO-1', sector: 'Biodiversity' },
    { policyCode: 'NE-CC-1', sector: 'Climate change' },
    { policyCode: 'SW-BIO-1', sector: 'Biodiversity' }
  ]

  beforeEach(() => {
    queryNonSpatialPolicies.mockResolvedValue(nonSpatial)
  })

  it('should union and de-duplicate policies across sites in different areas', async () => {
    findNearestMarinePlanArea
      .mockResolvedValueOnce({
        name: 'NE inshore',
        regionref: 'NE_i',
        distanceMetres: 1200
      })
      .mockResolvedValueOnce({
        name: 'SW inshore',
        regionref: 'SW_i',
        distanceMetres: 900
      })

    const policies = await runNearestAreaFallback({
      db: global.mockMongo,
      siteDetails: [site(1), site(2)],
      licenceId: 'abc123',
      logger
    })

    expect(policies.map((p) => p.policyCode).sort()).toEqual([
      'NE-BIO-1',
      'NE-CC-1',
      'SW-BIO-1'
    ])
  })

  it('should collapse inshore and offshore of the same region to one prefix', async () => {
    findNearestMarinePlanArea
      .mockResolvedValueOnce({
        name: 'NE inshore',
        regionref: 'NE_i',
        distanceMetres: 100
      })
      .mockResolvedValueOnce({
        name: 'NE offshore',
        regionref: 'NE_o',
        distanceMetres: 100
      })

    const policies = await runNearestAreaFallback({
      db: global.mockMongo,
      siteDetails: [site(1), site(2)],
      licenceId: 'abc123',
      logger
    })

    expect(policies.map((p) => p.policyCode).sort()).toEqual([
      'NE-BIO-1',
      'NE-CC-1'
    ])
  })

  it('should log the fallback warn with licence and area references', async () => {
    findNearestMarinePlanArea.mockResolvedValue({
      name: 'NE inshore',
      regionref: 'NE_i',
      distanceMetres: 2359
    })

    await runNearestAreaFallback({
      db: global.mockMongo,
      siteDetails: [site(1)],
      licenceId: 'abc123',
      logger
    })

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'mp-policies:nearest-neighbour-fallback',
          reference: expect.stringContaining('abc123')
        })
      }),
      expect.stringContaining('abc123')
    )
  })

  it('should warn on a prefix matching zero non-spatial codes and continue', async () => {
    findNearestMarinePlanArea.mockResolvedValue({
      name: 'West area',
      regionref: 'W_i',
      distanceMetres: 500
    })

    const policies = await runNearestAreaFallback({
      db: global.mockMongo,
      siteDetails: [site(1)],
      licenceId: 'abc123',
      logger
    })

    expect(policies).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'mp-policies:region-prefix-no-match'
        })
      }),
      expect.any(String)
    )
  })

  it('should return [] with a cannot-run warn when no site yields a nearest area', async () => {
    findNearestMarinePlanArea.mockResolvedValue(null)

    const policies = await runNearestAreaFallback({
      db: global.mockMongo,
      siteDetails: [site(1)],
      licenceId: 'abc123',
      logger
    })

    expect(policies).toEqual([])
    expect(queryNonSpatialPolicies).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'mp-policies:nearest-neighbour-cannot-run'
        })
      }),
      expect.any(String)
    )
  })
})
