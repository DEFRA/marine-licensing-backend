import { join } from 'path'
import ShapefileParser from './shapefile-parser.js'

const fixturesDir = join(process.cwd(), 'src/services/geo-parser/fixtures')
const testZipFile = 'example-test.zip'
const invalidZipFile = 'corrupted.zip'
const emptyZipFile = 'empty.zip'

describe('ShapefileParser', () => {
  let parser

  beforeEach(() => {
    parser = new ShapefileParser()
  })

  it('should implement GeoParser interface', () => {
    expect(parser.parse).toBeDefined()
    expect(typeof parser.parse).toBe('function')
  })

  it('should extract and parse a zip file containing shapefiles', async () => {
    const zipPath = join(fixturesDir, testZipFile)
    // Parse the zip file
    const result = await parser.parse(zipPath)

    // Verify the result structure
    expect(result).toBeDefined()
    expect(result.type).toBe('FeatureCollection')
    expect(Array.isArray(result.features)).toBe(true)
  })

  it('should throw an error for invalid zip file', async () => {
    const invalidZipPath = join(fixturesDir, invalidZipFile)
    await expect(parser.parse(invalidZipPath)).rejects.toThrow(
      'Failed to parse shapefile'
    )
  })

  it('should throw an error when no shapefiles found in zip', async () => {
    const zipPath = join(fixturesDir, emptyZipFile)
    await expect(parser.parse(zipPath)).rejects.toThrow(
      'No shapefiles found in zip archive'
    )
  })
})
