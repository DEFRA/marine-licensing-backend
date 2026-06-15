import { vi } from 'vitest'
import { queryArcGISPolicies } from './arcgis-client.js'
import { buildEmpGeometries } from '../../../../shared/common/helpers/emp/transforms/site-details.js'
import { config } from '../../../../config.js'

let fetchMock

beforeEach(() => {
  fetchMock = globalThis.fetchMock
})

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
  const geometry = { rings: [[[0, 0]]], spatialReference: { wkid: 4326 } }

  const arcgisResponse = (features) => JSON.stringify({ features })

  beforeEach(() => {
    vi.mocked(buildEmpGeometries).mockReturnValue([geometry])
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'marinePlanPolicies'
        ? {
            ...originalConfigGet('marinePlanPolicies'),
            arcgisUrl: 'https://arcgis.example/FeatureServer/0'
          }
        : originalConfigGet(key)
    )
  })

  it('should query the feature server with the site geometry and return the policies', async () => {
    fetchMock.mockResponseOnce(
      arcgisResponse([
        { attributes: { PolicyCode: 'SE-AQ-1', Sector: 'Aquaculture' } }
      ])
    )

    const policies = await queryArcGISPolicies({ siteDetails, logger })

    expect(buildEmpGeometries).toHaveBeenCalledWith(siteDetails)
    expect(policies).toEqual([{ policyCode: 'SE-AQ-1', sector: 'Aquaculture' }])

    const [url, options] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/query')
    const body = options.body
    expect(body.get('geometry')).toBe(JSON.stringify(geometry))
    expect(body.get('spatialRel')).toBe('esriSpatialRelIntersects')
    expect(body.get('outFields')).toBe('PolicyCode,Sector,isSpatial')
    expect(body.get('returnGeometry')).toBe('false')
  })

  it('should de-duplicate policies across geometries', async () => {
    vi.mocked(buildEmpGeometries).mockReturnValue([geometry, geometry])
    fetchMock
      .mockResponseOnce(
        arcgisResponse([
          { attributes: { PolicyCode: 'S-FISH-1' } },
          { attributes: { PolicyCode: 'S-AGG-2' } }
        ])
      )
      .mockResponseOnce(
        arcgisResponse([{ attributes: { PolicyCode: 'S-FISH-1' } }])
      )

    const policies = await queryArcGISPolicies({ siteDetails, logger })

    expect(policies.map((p) => p.policyCode)).toEqual(['S-FISH-1', 'S-AGG-2'])
  })

  it('should skip features without a PolicyCode and default sector to null', async () => {
    fetchMock.mockResponseOnce(
      arcgisResponse([
        { attributes: { PolicyCode: 'S-CAB-1' } },
        { attributes: { irrelevant: true } },
        {}
      ])
    )

    const policies = await queryArcGISPolicies({ siteDetails, logger })

    expect(policies).toEqual([{ policyCode: 'S-CAB-1', sector: null }])
  })

  it('should throw when ArcGIS reports an error inside a 200 response', async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ error: { code: 400, message: 'Invalid geometry' } })
    )

    await expect(queryArcGISPolicies({ siteDetails, logger })).rejects.toThrow(
      'ArcGIS feature-server query returned error 400: Invalid geometry'
    )
  })
})
