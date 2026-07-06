import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { queryArcGISPolicies } from './arcgis-client.js'
import { buildEmpGeometries } from '../../../../shared/common/helpers/emp/transforms/site-details.js'
import { config } from '../../../../config.js'

vi.mock('@hapi/wreck')

vi.mock(
  '../../../../shared/common/helpers/emp/transforms/site-details.js',
  () => ({
    buildEmpGeometries: vi.fn()
  })
)

const originalConfigGet = config.get.bind(config)

describe('queryArcGISPolicies', () => {
  const logger = { info: vi.fn(), error: vi.fn() }
  const siteDetails = [{ coordinatesType: 'coordinates' }]
  const geometryA = {
    rings: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0]
      ]
    ],
    spatialReference: { wkid: 4326 }
  }
  const geometryB = {
    rings: [
      [
        [2, 2],
        [3, 2],
        [3, 3],
        [2, 2]
      ]
    ],
    spatialReference: { wkid: 4326 }
  }

  const arcgisSuccess = (features) => ({
    res: { statusCode: 200 },
    payload: { features }
  })

  beforeEach(() => {
    vi.mocked(buildEmpGeometries).mockReturnValue([geometryA])
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'marinePlanPolicies'
        ? {
            ...originalConfigGet('marinePlanPolicies'),
            arcgisUrl: 'https://arcgis.example/FeatureServer/0'
          }
        : originalConfigGet(key)
    )
    Wreck.post.mockResolvedValue(arcgisSuccess([]))
  })

  it('should query the feature server with the combined geometry and return the policies', async () => {
    Wreck.post.mockResolvedValue(
      arcgisSuccess([
        { attributes: { PolicyCode: 'SE-AQ-1', Sector: 'Aquaculture' } }
      ])
    )

    const policies = await queryArcGISPolicies({ siteDetails, logger })

    expect(buildEmpGeometries).toHaveBeenCalledWith(siteDetails)
    expect(policies).toEqual([{ policyCode: 'SE-AQ-1', sector: 'Aquaculture' }])

    const [url, options] = Wreck.post.mock.calls[0]
    expect(url).toContain('/query')
    const body = options.payload
    const params = new URLSearchParams(body.toString())
    expect(JSON.parse(params.get('geometry'))).toEqual({
      rings: geometryA.rings,
      spatialReference: geometryA.spatialReference
    })
    expect(params.get('spatialRel')).toBe('esriSpatialRelIntersects')
    expect(params.get('outFields')).toBe('PolicyCode,Sector')
    expect(params.get('returnGeometry')).toBe('false')
    expect(options.headers['content-type']).toBe(
      'application/x-www-form-urlencoded'
    )
  })

  it('should combine rings from multiple sites into a single POST', async () => {
    vi.mocked(buildEmpGeometries).mockReturnValue([geometryA, geometryB])
    Wreck.post.mockResolvedValue(
      arcgisSuccess([
        { attributes: { PolicyCode: 'S-FISH-1' } },
        { attributes: { PolicyCode: 'S-AGG-2' } }
      ])
    )

    const policies = await queryArcGISPolicies({ siteDetails, logger })

    expect(Wreck.post).toHaveBeenCalledTimes(1)
    expect(policies.map((p) => p.policyCode)).toEqual(['S-FISH-1', 'S-AGG-2'])

    const [, options] = Wreck.post.mock.calls[0]
    const params = new URLSearchParams(options.payload.toString())
    const sentGeometry = JSON.parse(params.get('geometry'))
    expect(sentGeometry.rings).toEqual([...geometryA.rings, ...geometryB.rings])
  })

  it('should skip features without a PolicyCode and default sector to null', async () => {
    Wreck.post.mockResolvedValue(
      arcgisSuccess([
        { attributes: { PolicyCode: 'S-CAB-1' } },
        { attributes: { irrelevant: true } },
        {}
      ])
    )

    const policies = await queryArcGISPolicies({ siteDetails, logger })

    expect(policies).toEqual([{ policyCode: 'S-CAB-1', sector: null }])
  })

  it('should de-duplicate policies that appear in the response more than once', async () => {
    Wreck.post.mockResolvedValue(
      arcgisSuccess([
        { attributes: { PolicyCode: 'S-FISH-1' } },
        { attributes: { PolicyCode: 'S-AGG-2' } },
        { attributes: { PolicyCode: 'S-FISH-1' } }
      ])
    )

    const policies = await queryArcGISPolicies({ siteDetails, logger })

    expect(policies.map((p) => p.policyCode)).toEqual(['S-FISH-1', 'S-AGG-2'])
  })

  it('should return an empty array without calling ArcGIS when there are no geometries', async () => {
    vi.mocked(buildEmpGeometries).mockReturnValue([])

    const policies = await queryArcGISPolicies({ siteDetails, logger })

    expect(policies).toEqual([])
    expect(Wreck.post).not.toHaveBeenCalled()
  })

  it('should include the licence id as the log event reference', async () => {
    Wreck.post.mockResolvedValue(arcgisSuccess([]))

    await queryArcGISPolicies({ siteDetails, licenceId: 'licence-123', logger })

    expect(logger.info).toHaveBeenCalledWith(
      {
        event: expect.objectContaining({ reference: 'licence-123' })
      },
      expect.stringContaining('ArcGIS feature-server query completed in')
    )
  })

  it('should throw when ArcGIS reports an error inside a 200 response', async () => {
    Wreck.post.mockResolvedValue({
      res: { statusCode: 200 },
      payload: { error: { code: 400, message: 'Invalid geometry' } }
    })

    await expect(queryArcGISPolicies({ siteDetails, logger })).rejects.toThrow(
      'ArcGIS feature-server query returned error 400: Invalid geometry'
    )
  })
})
