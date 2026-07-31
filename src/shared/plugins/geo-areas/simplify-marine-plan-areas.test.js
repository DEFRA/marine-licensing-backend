import {
  collectionMarinePlanAreas,
  collectionMarinePlanAreasSimplified
} from '../../common/constants/db-collections.js'
import { buildSimplifiedMarinePlanAreas } from './simplify-marine-plan-areas.js'

// A ~200-vertex circle of radius ~0.5° around lon/lat — detailed enough to shrink.
const detailedCircle = (cx, cy, vertices = 200) => {
  const ring = Array.from({ length: vertices }, (_, i) => {
    const angle = (2 * Math.PI * i) / vertices
    return [cx + 0.5 * Math.cos(angle), cy + 0.5 * Math.sin(angle)]
  })
  ring.push(ring[0])
  return { type: 'Polygon', coordinates: [ring] }
}

const areaDoc = (name, regionref, geometry) => ({
  type: 'Feature',
  name,
  geometry,
  properties: { regionref, info: name }
})

describe('buildSimplifiedMarinePlanAreas', () => {
  const source = () => global.mockMongo.collection(collectionMarinePlanAreas)
  const target = () =>
    global.mockMongo.collection(collectionMarinePlanAreasSimplified)
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  beforeEach(async () => {
    await source().deleteMany({})
    await target().deleteMany({})
  })

  it('should build a simplified copy with fewer vertices and a 2dsphere index', async () => {
    await source().insertOne(
      areaDoc('East inshore', 'E_i', detailedCircle(1, 52))
    )

    const count = await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(count).toBe(1)
    const [doc] = await target().find({}).toArray()
    expect(doc.properties.regionref).toBe('E_i')
    expect(doc.geometry.coordinates[0].length).toBeLessThan(200)
    const indexes = await target().indexes()
    expect(indexes.some((ix) => ix.key.geometry === '2dsphere')).toBe(true)
  })

  it('should replace previous contents on rebuild', async () => {
    await source().insertOne(
      areaDoc('East inshore', 'E_i', detailedCircle(1, 52))
    )
    await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)
    await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(await target().countDocuments()).toBe(1)
  })

  it('should skip the build and warn when the source collection is empty', async () => {
    const count = await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(count).toBe(0)
    expect(await target().countDocuments()).toBe(0)
    expect(logger.warn).toHaveBeenCalled()
  })
})
