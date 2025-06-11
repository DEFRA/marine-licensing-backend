import { join } from 'path'
import { promises as fs } from 'fs'
import KmlParser from './kml.js'

const fixturesDir = join(process.cwd(), 'src/services/geo-parser/fixtures')
const kmlTestFile = 'example-test.kml'

describe('KML Parser', () => {
  const fixturesPath = fixturesDir
  let parser

  beforeEach(() => {
    parser = new KmlParser()
  })

  it('should successfully parse a KML file to GeoJSON', async () => {
    const kmlPath = join(fixturesPath, kmlTestFile)
    const result = await parser.parse(kmlPath)
    // console.dir(result, { depth: null })

    // Basic GeoJSON structure validation
    expect(result).toBeDefined()
    expect(result.type).toBe('FeatureCollection')
    expect(Array.isArray(result.features)).toBe(true)
    expect(result.features.length).toBeGreaterThan(0)

    // Validate features have required GeoJSON properties
    result.features.forEach((feature) => {
      expect(feature.type).toBe('Feature')
      expect(feature.geometry).toBeDefined()
      expect(feature.geometry.type).toBeDefined()
      expect(feature.geometry.coordinates).toBeDefined()
    })
  })

  it('should have the correct coordinates', async () => {
    const kmlPath = join(fixturesPath, kmlTestFile)
    const result = await parser.parse(kmlPath)
    expect(result.features[0].geometry.coordinates).toEqual([
      -3.043604493362138, 51.29373558656162, 0
    ])
    expect(result.features[0].properties.name).toEqual('Test placemark 1')
  })

  it('should throw an error for non-existent file', async () => {
    await expect(parser.parse('non-existent.kml')).rejects.toThrow(
      'Failed to parse KML file'
    )
  })

  it('should throw an error for invalid XML content', async () => {
    const invalidKmlPath = join(fixturesPath, 'temp-invalid.kml')
    try {
      await fs.writeFile(invalidKmlPath, 'This is not valid KML content')
      await expect(parser.parse(invalidKmlPath)).rejects.toThrow(
        'Failed to parse KML file'
      )
    } finally {
      // Clean up temp file even if test fails
      try {
        await fs.unlink(invalidKmlPath)
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  })
})
