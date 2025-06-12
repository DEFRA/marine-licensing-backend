import { join } from 'path'
import { writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import AdmZip from 'adm-zip'
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

  describe('zip extraction safety checks', () => {
    let safetyParser
    let tempZipPath

    beforeEach(async () => {
      safetyParser = new ShapefileParser({
        maxFiles: 3,
        maxSize: 1000,
        thresholdRatio: 2
      })
      tempZipPath = join(tmpdir(), 'test.zip')
    })

    afterEach(async () => {
      try {
        await rm(tempZipPath)
      } catch (error) {
        // Ignore cleanup errors
      }
    })

    it('should throw error when zip contains too many files', async () => {
      // Create a zip with 4 files (exceeding maxFiles of 3)
      const zip = new AdmZip()
      for (let i = 0; i < 4; i++) {
        zip.addFile(`file${i}.txt`, Buffer.from('test content'))
      }
      await writeFile(tempZipPath, zip.toBuffer())

      await expect(safetyParser.extractZip(tempZipPath)).rejects.toThrow(
        'Reached max number of files'
      )
    })

    it('should throw error when zip total size exceeds limit', async () => {
      // Create a zip with a file larger than maxSize
      const zip = new AdmZip()
      const largeContent = Buffer.alloc(1200) // Exceeds maxSize of 1000
      zip.addFile('large.txt', largeContent)
      await writeFile(tempZipPath, zip.toBuffer())

      await expect(safetyParser.extractZip(tempZipPath)).rejects.toThrow(
        'Reached max size'
      )
    })

    it('should throw error when compression ratio exceeds threshold', async () => {
      // Create a zip with highly compressible content (repeating pattern)
      const zip = new AdmZip()
      const repeatingContent = Buffer.from('a'.repeat(1000))
      zip.addFile('compressed.txt', repeatingContent)
      await writeFile(tempZipPath, zip.toBuffer())

      await expect(safetyParser.extractZip(tempZipPath)).rejects.toThrow(
        'Reached max compression ratio'
      )
    })

    it('should allow extraction of safe zip file', async () => {
      // Create a zip with acceptable parameters
      const zip = new AdmZip()
      zip.addFile('safe.txt', Buffer.from('Safe content'))
      await writeFile(tempZipPath, zip.toBuffer())

      const extractPath = await safetyParser.extractZip(tempZipPath)
      expect(extractPath).toMatch(/shapefile-.*/)
    })
  })

  describe('getSafeOptions', () => {
    it('should return current safety options', () => {
      const customParser = new ShapefileParser({
        maxFiles: 3,
        maxSize: 1000,
        thresholdRatio: 2
      })
      const options = customParser.getSafeOptions()
      expect(options).toEqual({
        maxFiles: 3,
        maxSize: 1000,
        thresholdRatio: 2
      })
    })

    it('should return a copy of the options', () => {
      const customParser = new ShapefileParser({
        maxFiles: 3,
        maxSize: 1000,
        thresholdRatio: 2
      })
      const options = customParser.getSafeOptions()
      options.maxFiles = 999

      expect(customParser.getSafeOptions().maxFiles).toBe(3)
    })
  })
})
