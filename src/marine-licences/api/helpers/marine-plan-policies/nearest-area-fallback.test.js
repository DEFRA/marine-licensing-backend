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

const warnCallsFor = (action) =>
  logger.warn.mock.calls.filter(([payload]) => payload.event.action === action)

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

  it('should pass the licence id to each site lookup so its duration line is attributable', async () => {
    findNearestMarinePlanArea.mockResolvedValue({
      name: 'NE inshore',
      regionref: 'NE_i',
      distanceMetres: 1200
    })

    await runNearestAreaFallback({
      db: global.mockMongo,
      siteDetails: [site(1), site(2)],
      licenceId: 'abc123',
      logger
    })

    expect(findNearestMarinePlanArea).toHaveBeenCalledTimes(2)
    for (const [args] of findNearestMarinePlanArea.mock.calls) {
      expect(args.licenceId).toBe('abc123')
    }
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

  it('should log the fallback warn with licence, coverage and area references', async () => {
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
          action: 'mp-policies:nearest-area-fallback',
          outcome: 'success',
          reference: expect.stringContaining('abc123 1/1 sites')
        })
      }),
      expect.stringContaining('abc123')
    )
  })

  it('should round the distance to the nearest metre in the provenance reference and message', async () => {
    findNearestMarinePlanArea.mockResolvedValue({
      name: 'NE inshore',
      regionref: 'NE_i',
      distanceMetres: 1234.56
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
          action: 'mp-policies:nearest-area-fallback',
          reference: expect.stringContaining('area: NE_i, distance: 1235m')
        })
      }),
      expect.stringContaining('area: NE_i, distance: 1235m')
    )
  })

  it('should derive policies from the sites that resolved an area when another site resolves none', async () => {
    findNearestMarinePlanArea
      .mockResolvedValueOnce({
        name: 'NE inshore',
        regionref: 'NE_i',
        distanceMetres: 1200
      })
      .mockResolvedValueOnce(null)

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
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'mp-policies:nearest-area-fallback',
          reference: expect.stringContaining('1/2 sites')
        })
      }),
      expect.any(String)
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
          action: 'mp-policies:region-prefix-no-match',
          outcome: 'failure',
          reference: 'abc123 prefix=W-'
        })
      }),
      expect.any(String)
    )
  })

  it('should fire the region-prefix-no-match warn exactly once when two sites collapse to the same unmatched prefix', async () => {
    findNearestMarinePlanArea
      .mockResolvedValueOnce({
        name: 'West area A',
        regionref: 'W_i',
        distanceMetres: 500
      })
      .mockResolvedValueOnce({
        name: 'West area B',
        regionref: 'W_o',
        distanceMetres: 600
      })

    await runNearestAreaFallback({
      db: global.mockMongo,
      siteDetails: [site(1), site(2)],
      licenceId: 'abc123',
      logger
    })

    expect(warnCallsFor('mp-policies:region-prefix-no-match')).toHaveLength(1)
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
          action: 'mp-policies:nearest-area-cannot-run',
          outcome: 'failure',
          reference: 'abc123'
        })
      }),
      expect.any(String)
    )
  })

  it('should treat missing siteDetails as no sites and warn cannot-run', async () => {
    const policies = await runNearestAreaFallback({
      db: global.mockMongo,
      siteDetails: undefined,
      licenceId: 'abc123',
      logger
    })

    expect(policies).toEqual([])
    expect(findNearestMarinePlanArea).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: 'mp-policies:nearest-area-cannot-run',
          reason: expect.stringContaining('no usable site geometry')
        })
      }),
      expect.any(String)
    )
  })

  it('should propagate a rejection from findNearestMarinePlanArea rather than swallowing it', async () => {
    findNearestMarinePlanArea.mockRejectedValue(new Error('geo query failed'))

    await expect(
      runNearestAreaFallback({
        db: global.mockMongo,
        siteDetails: [site(1)],
        licenceId: 'abc123',
        logger
      })
    ).rejects.toThrow('geo query failed')
  })

  it('should propagate a rejection from queryNonSpatialPolicies rather than swallowing it', async () => {
    findNearestMarinePlanArea.mockResolvedValue({
      name: 'NE inshore',
      regionref: 'NE_i',
      distanceMetres: 100
    })
    queryNonSpatialPolicies.mockRejectedValue(new Error('arcgis query failed'))

    await expect(
      runNearestAreaFallback({
        db: global.mockMongo,
        siteDetails: [site(1)],
        licenceId: 'abc123',
        logger
      })
    ).rejects.toThrow('arcgis query failed')
  })

  it('should process sites sequentially, never running two nearest-area lookups concurrently', async () => {
    let inFlight = 0
    let maxInFlight = 0
    findNearestMarinePlanArea.mockImplementation(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      // Yield a tick so a parallelised caller (e.g. Promise.all) would have
      // started every lookup before any of them resolved.
      await Promise.resolve()
      inFlight--
      return { name: 'NE inshore', regionref: 'NE_i', distanceMetres: 100 }
    })

    await runNearestAreaFallback({
      db: global.mockMongo,
      siteDetails: [site(1), site(2), site(3)],
      licenceId: 'abc123',
      logger
    })

    expect(maxInFlight).toBe(1)
  })
})
