import {
  collectionMarinePlanAreas,
  collectionMarinePlanAreasSimplified
} from '../../common/constants/db-collections.js'

// Forces the zero-width buffer to collapse, or simplification to throw, only
// for the feature flagged via properties.regionref — so those geometries
// exercise the fallback while other features go through the real turf
// implementation unaffected.
const COLLAPSING_REGIONREF = 'collapses-under-buffer'
const THROWING_REGIONREF = 'throws-during-simplify'

// Derived exactly as the plugin derives it. A build that used any other
// namespace would leave the scratch collection these tests seed and inspect
// untouched, so the tests below still pin the name.
const SCRATCH_COLLECTION = `${collectionMarinePlanAreasSimplified}-build`

vi.mock('@turf/turf', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    simplify: vi.fn((feature, options) => {
      if (feature?.properties?.regionref === THROWING_REGIONREF) {
        throw new Error('simplify blew up')
      }
      return actual.simplify(feature, options)
    }),
    buffer: vi.fn((feature, radius, options) => {
      if (feature?.properties?.regionref === COLLAPSING_REGIONREF) {
        return undefined
      }
      return actual.buffer(feature, radius, options)
    })
  }
})

const { buildSimplifiedMarinePlanAreas, simplifyMarinePlanAreasPlugin } =
  await import('./simplify-marine-plan-areas.js')

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
  const scratch = () => global.mockMongo.collection(SCRATCH_COLLECTION)
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  const namespaceExists = async (name) =>
    (await global.mockMongo.listCollections({ name }).toArray()).length > 0

  const targetHasGeoIndex = async () =>
    (await target().indexes()).some((ix) => ix.key.geometry === '2dsphere')

  // Forwards every operation to the in-memory Mongo, so a test can observe or
  // break one named collection while the rest of the build runs for real.
  const forwardingDb = (collectionFor) => ({
    collection: (name) =>
      collectionFor?.(name) ?? global.mockMongo.collection(name),
    dropCollection: (name) => global.mockMongo.dropCollection(name),
    renameCollection: (from, to, options) =>
      global.mockMongo.renameCollection(from, to, options)
  })

  beforeEach(async () => {
    await source().deleteMany({})
    // Dropped rather than emptied: the build swaps a whole namespace in, so
    // tests that assert on a first-ever run need the target genuinely absent.
    await global.mockMongo.dropCollection(collectionMarinePlanAreasSimplified)
    await global.mockMongo.dropCollection(SCRATCH_COLLECTION)
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
    expect(await targetHasGeoIndex()).toBe(true)
  })

  it('should replace previous contents on rebuild', async () => {
    await source().insertOne(
      areaDoc('East inshore', 'E_i', detailedCircle(1, 52))
    )
    await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)
    await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(await target().countDocuments()).toBe(1)
    expect(await targetHasGeoIndex()).toBe(true)
  })

  it('should build and index the collection when it does not exist yet', async () => {
    expect(await namespaceExists(collectionMarinePlanAreasSimplified)).toBe(
      false
    )
    await source().insertOne(
      areaDoc('East inshore', 'E_i', detailedCircle(1, 52))
    )

    const count = await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(count).toBe(1)
    expect(await target().countDocuments()).toBe(1)
    expect(await targetHasGeoIndex()).toBe(true)
  })

  it('should discard a scratch collection abandoned by an earlier crashed build', async () => {
    await scratch().insertOne(
      areaDoc('Stale half-built area', 'stale', detailedCircle(9, 45))
    )
    await source().insertOne(
      areaDoc('East inshore', 'E_i', detailedCircle(1, 52))
    )

    const count = await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(count).toBe(1)
    expect(await namespaceExists(SCRATCH_COLLECTION)).toBe(false)
    const docs = await target().find({}).toArray()
    expect(docs).toHaveLength(1)
    expect(docs[0].properties.regionref).toBe('E_i')
  })

  it('should leave the previous collection and its index intact when the build fails partway', async () => {
    await source().insertOne(
      areaDoc('East inshore', 'E_i', detailedCircle(1, 52))
    )
    await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)
    const before = await target().find({}).toArray()

    // A second source area, so a build that did complete would be visible.
    await source().insertOne(
      areaDoc('South inshore', 'S_i', detailedCircle(1, 50))
    )
    const failingScratch = {
      insertMany: () => Promise.reject(new Error('scratch build failed')),
      createIndex: () => Promise.resolve()
    }
    const db = forwardingDb((name) =>
      name === SCRATCH_COLLECTION ? failingScratch : undefined
    )

    await expect(buildSimplifiedMarinePlanAreas(db, logger)).rejects.toThrow(
      'scratch build failed'
    )

    expect(await target().find({}).toArray()).toEqual(before)
    expect(await targetHasGeoIndex()).toBe(true)
  })

  it('should never clear the live collection in place while rebuilding', async () => {
    await source().insertOne(
      areaDoc('East inshore', 'E_i', detailedCircle(1, 52))
    )
    await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    const deleteManyTargets = []
    const db = forwardingDb((name) => {
      const collection = global.mockMongo.collection(name)
      return {
        find: (...args) => collection.find(...args),
        insertMany: (...args) => collection.insertMany(...args),
        createIndex: (...args) => collection.createIndex(...args),
        deleteMany: (...args) => {
          deleteManyTargets.push(name)
          return collection.deleteMany(...args)
        }
      }
    })

    await buildSimplifiedMarinePlanAreas(db, logger)

    expect(deleteManyTargets).not.toContain(collectionMarinePlanAreasSimplified)
    expect(await target().countDocuments()).toBe(1)
    expect(await targetHasGeoIndex()).toBe(true)
  })

  it('should skip the build and warn when the source collection is empty', async () => {
    const count = await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(count).toBe(0)
    expect(await target().countDocuments()).toBe(0)
    expect(logger.warn).toHaveBeenCalled()
  })

  it('should default properties to an empty object when the source feature has none', async () => {
    await source().insertOne({
      type: 'Feature',
      name: 'No properties',
      geometry: detailedCircle(1, 52)
    })

    const count = await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(count).toBe(1)
    const [doc] = await target().find({}).toArray()
    expect(doc.properties).toEqual({})
  })

  it('should keep full-fidelity geometry when the zero-width buffer collapses a feature, and warn on it and on the summary', async () => {
    const collapsingGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 50],
          [0.01, 50],
          [0.01, 50.01],
          [0, 50.01],
          [0, 50]
        ]
      ]
    }

    await source().insertOne(
      areaDoc('East inshore', 'E_i', detailedCircle(1, 52))
    )
    await source().insertOne(
      areaDoc('Collapsing', COLLAPSING_REGIONREF, collapsingGeometry)
    )

    const count = await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(count).toBe(2)
    const docs = await target().find({}).toArray()
    const collapsedDoc = docs.find(
      (doc) => doc.properties.regionref === COLLAPSING_REGIONREF
    )
    const normalDoc = docs.find((doc) => doc.properties.regionref === 'E_i')

    expect(collapsedDoc.geometry).toEqual(collapsingGeometry)
    expect(normalDoc.geometry.coordinates[0].length).toBeLessThan(200)

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('collapsed')
    )
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('kept at full fidelity')
    )
  })

  it('should keep full-fidelity geometry when simplification throws, and warn with the error', async () => {
    const validGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [1, 50],
          [1.01, 50],
          [1.01, 50.01],
          [1, 50.01],
          [1, 50]
        ]
      ]
    }

    await source().insertOne(
      areaDoc('Broken', THROWING_REGIONREF, validGeometry)
    )

    const count = await buildSimplifiedMarinePlanAreas(global.mockMongo, logger)

    expect(count).toBe(1)
    const [doc] = await target().find({}).toArray()

    expect(doc.geometry).toEqual(validGeometry)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Object) }),
      expect.stringContaining('Simplification failed')
    )
  })
})

describe('simplifyMarinePlanAreasPlugin', () => {
  const buildServer = ({ locker, db, logger }) => ({
    locker,
    db,
    logger
  })

  it('should skip the build and log info when the lock is unavailable', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const collection = vi.fn()
    const server = buildServer({
      locker: { lock: vi.fn().mockResolvedValue(null) },
      db: { collection },
      logger
    })

    await simplifyMarinePlanAreasPlugin.plugin.register(server)

    expect(collection).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalled()
  })

  it('should log an error and resolve without throwing when the build fails', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const lock = { free: vi.fn().mockResolvedValue(true) }
    const collection = vi.fn(() => {
      throw new Error('connection lost')
    })
    const server = buildServer({
      locker: { lock: vi.fn().mockResolvedValue(lock) },
      db: { collection },
      logger
    })

    await expect(
      simplifyMarinePlanAreasPlugin.plugin.register(server)
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalled()
    expect(lock.free).toHaveBeenCalled()
  })

  it('should log an error but not throw when releasing the lock fails', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const lock = {
      free: vi.fn().mockRejectedValue(new Error('lock already expired'))
    }
    const collection = vi.fn(() => ({
      find: () => ({ toArray: async () => [] })
    }))
    const server = buildServer({
      locker: { lock: vi.fn().mockResolvedValue(lock) },
      db: { collection },
      logger
    })

    await expect(
      simplifyMarinePlanAreasPlugin.plugin.register(server)
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Object) }),
      'Failed to release simplify-marine-plan-areas lock'
    )
  })

  it('should log an error and resolve without throwing when lock acquisition itself rejects', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const collection = vi.fn()
    const server = buildServer({
      locker: {
        lock: vi.fn().mockRejectedValue(new Error('write timeout'))
      },
      db: { collection },
      logger
    })

    await expect(
      simplifyMarinePlanAreasPlugin.plugin.register(server)
    ).resolves.toBeUndefined()

    expect(collection).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Object) }),
      'Failed to build simplified marine plan areas'
    )
  })
})
