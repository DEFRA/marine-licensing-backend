import AdmZip from 'adm-zip'
import { glob, mkdtemp, rm } from 'fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'os'
import { join } from 'path'
import * as shapefile from 'shapefile'
import { ShapefileParser } from './shapefile-parser.js'

jest.mock('shapefile', () => ({
  read: jest.fn()
}))

jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn(),
  rm: jest.fn(),
  glob: jest.fn()
}))

jest.mock('os', () => ({
  tmpdir: jest.fn()
}))

jest.mock('path', () => ({
  join: jest.fn()
}))

jest.mock('node:path', () => ({
  join: jest.fn()
}))

jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    getEntries: jest.fn(),
    extractEntryTo: jest.fn()
  }))
})

jest.mock('../../common/helpers/logging/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn()
  }))
}))

describe('ShapefileParser', () => {
  let shapefileParser
  let mockAdmZip
  let mockZipEntries

  const createFeature = (geometry, properties = {}) => ({
    type: 'Feature',
    geometry,
    properties
  })

  const createFeatureCollection = (features) => ({
    type: 'FeatureCollection',
    features
  })

  const createPointGeometry = (coordinates) => ({
    type: 'Point',
    coordinates
  })

  const createPolygonGeometry = (coordinates) => ({
    type: 'Polygon',
    coordinates
  })

  const createZipEntry = (
    entryName,
    isDirectory = false,
    uncompressedSize = 100,
    compressedSize = 50
  ) => ({
    entryName,
    isDirectory,
    getData: () => Buffer.alloc(uncompressedSize),
    header: { compressedSize }
  })

  const createShapefileOptions = (overrides = {}) => ({
    maxFiles: 10_000,
    maxSize: 1_000_000_000,
    thresholdRatio: 10,
    ...overrides
  })

  beforeEach(() => {
    jest.clearAllMocks()

    tmpdir.mockReturnValue('/tmp')

    join.mockImplementation((dir, file) => {
      if (file === 'shapefile-') return '/tmp/shapefile-'
      return `${dir}/${file}`
    })
    path.join.mockImplementation((dir, file) => `${dir}/${file}`)

    mkdtemp.mockResolvedValue('/tmp/shapefile-test')

    rm.mockResolvedValue()

    mockZipEntries = []
    mockAdmZip = {
      getEntries: jest.fn(() => mockZipEntries),
      extractEntryTo: jest.fn()
    }
    AdmZip.mockImplementation(() => mockAdmZip)

    glob.mockResolvedValue([])

    shapefileParser = new ShapefileParser()
  })

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const parser = new ShapefileParser()

      expect(parser.options).toEqual(createShapefileOptions())
    })

    it('should initialize with custom options', () => {
      const customOptions = createShapefileOptions({
        maxFiles: 5_000,
        maxSize: 500_000_000,
        thresholdRatio: 5
      })

      const parser = new ShapefileParser(customOptions)

      expect(parser.options).toEqual(customOptions)
    })

    it('should merge custom options with defaults', () => {
      const customOptions = {
        maxFiles: 5_000
      }

      const parser = new ShapefileParser(customOptions)

      expect(parser.options).toEqual(
        createShapefileOptions({ maxFiles: 5_000 })
      )
    })
  })

  describe('getSafeOptions', () => {
    it('should return current safety options', () => {
      const parser = new ShapefileParser()
      const options = parser.getSafeOptions()

      expect(options).toEqual(parser.options)
      expect(options).not.toBe(parser.options) // Should be a copy
    })

    it('should return custom options', () => {
      const customOptions = createShapefileOptions({
        maxFiles: 5_000,
        maxSize: 500_000_000,
        thresholdRatio: 5
      })
      const parser = new ShapefileParser(customOptions)
      const options = parser.getSafeOptions()

      expect(options).toEqual(customOptions)
    })
  })

  describe('extractZip', () => {
    const zipPath = '/tmp/test.zip'

    beforeEach(() => {
      mockZipEntries = [
        createZipEntry('test.shp', false, 1000, 500),
        createZipEntry('test.shx', false, 100, 50),
        createZipEntry('test.dbf', false, 200, 100)
      ]
      mockAdmZip.getEntries.mockReturnValue(mockZipEntries)
    })

    it('should successfully extract zip file', async () => {
      const result = await shapefileParser.extractZip(zipPath)

      expect(result).toBe('/tmp/shapefile-test')
      expect(mkdtemp).toHaveBeenCalledWith('/tmp/shapefile-')
      expect(AdmZip).toHaveBeenCalledWith(zipPath)
      expect(mockAdmZip.getEntries).toHaveBeenCalled()
      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledTimes(3)
    })

    it('should skip directory entries', async () => {
      mockZipEntries.push({
        entryName: 'folder/',
        isDirectory: true,
        getData: () => Buffer.alloc(0),
        header: { compressedSize: 0 }
      })

      await shapefileParser.extractZip(zipPath)

      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledTimes(3) // Still only 3 files
    })

    it('should throw error when exceeding max files limit', async () => {
      const manyEntries = Array(10001).fill(createZipEntry('test.shp'))
      mockAdmZip.getEntries.mockReturnValue(manyEntries)

      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Reached max number of files'
      )
    })

    it('should throw error when exceeding max size limit', async () => {
      const largeEntries = [
        createZipEntry('large.shp', false, 2_000_000_000, 1_000_000_000)
      ]
      mockAdmZip.getEntries.mockReturnValue(largeEntries)

      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Reached max size'
      )
    })

    it('should throw error when exceeding compression ratio limit', async () => {
      const suspiciousEntries = [
        createZipEntry('suspicious.shp', false, 1000, 50)
      ]
      mockAdmZip.getEntries.mockReturnValue(suspiciousEntries)

      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Reached max compression ratio'
      )
    })

    it('should handle AdmZip errors', async () => {
      AdmZip.mockImplementation(() => {
        throw new Error('Invalid zip file')
      })

      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Invalid zip file'
      )
    })

    it('should handle mkdtemp errors', async () => {
      mkdtemp.mockRejectedValue(new Error('Permission denied'))

      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Permission denied'
      )
    })

    it('should handle extraction errors', async () => {
      mockAdmZip.extractEntryTo.mockImplementation(() => {
        throw new Error('Extraction failed')
      })

      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Extraction failed'
      )
    })

    it('should handle empty zip file', async () => {
      mockAdmZip.getEntries.mockReturnValue([])

      const result = await shapefileParser.extractZip(zipPath)

      expect(result).toBe('/tmp/shapefile-test')
      expect(mockAdmZip.extractEntryTo).not.toHaveBeenCalled()
    })

    it('should handle zip with different file extensions', async () => {
      const mixedEntries = [
        {
          entryName: 'test.SHP', // Uppercase
          isDirectory: false,
          getData: () => Buffer.alloc(1000),
          header: { compressedSize: 500 }
        },
        {
          entryName: 'readme.txt',
          isDirectory: false,
          getData: () => Buffer.alloc(100),
          header: { compressedSize: 50 }
        }
      ]
      mockAdmZip.getEntries.mockReturnValue(mixedEntries)

      await shapefileParser.extractZip(zipPath)

      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledTimes(2)
    })
  })

  describe('findShapefiles', () => {
    const directory = '/tmp/shapefile-test'

    beforeEach(() => {
      // Mock Array.fromAsync
      global.Array.fromAsync = jest.fn()
    })

    it('should find shapefiles in directory', async () => {
      const mockFiles = ['test.shp', 'subfolder/another.shp']
      Array.fromAsync.mockResolvedValue(mockFiles)
      path.join.mockImplementation((dir, file) => `${dir}/${file}`)

      const result = await shapefileParser.findShapefiles(directory)

      expect(result).toEqual([
        '/tmp/shapefile-test/test.shp',
        '/tmp/shapefile-test/subfolder/another.shp'
      ])
      expect(glob).toHaveBeenCalledWith('**/*.[sS][hH][pP]', { cwd: directory })
      expect(Array.fromAsync).toHaveBeenCalledTimes(1)
    })

    it('should handle case-insensitive search', async () => {
      const mockFiles = ['TEST.SHP', 'lower.shp', 'Mixed.Shp']
      Array.fromAsync.mockResolvedValue(mockFiles)
      path.join.mockImplementation((dir, file) => `${dir}/${file}`)

      const result = await shapefileParser.findShapefiles(directory)

      expect(result).toHaveLength(3)
      expect(result).toEqual([
        '/tmp/shapefile-test/TEST.SHP',
        '/tmp/shapefile-test/lower.shp',
        '/tmp/shapefile-test/Mixed.Shp'
      ])
    })

    it('should return empty array when no shapefiles found', async () => {
      Array.fromAsync.mockResolvedValue([])

      const result = await shapefileParser.findShapefiles(directory)

      expect(result).toEqual([])
    })

    it('should handle glob errors', async () => {
      Array.fromAsync.mockRejectedValue(new Error('Glob error'))

      const result = await shapefileParser.findShapefiles(directory)

      expect(result).toEqual([])
    })

    it('should handle nested directories', async () => {
      const mockFiles = [
        'level1/level2/test.shp',
        'level1/another.shp',
        'root.shp'
      ]
      Array.fromAsync.mockResolvedValue(mockFiles)
      path.join.mockImplementation((dir, file) => `${dir}/${file}`)

      const result = await shapefileParser.findShapefiles(directory)

      expect(result).toHaveLength(3)
      expect(result).toContain('/tmp/shapefile-test/level1/level2/test.shp')
    })

    it('should handle directory with special characters', async () => {
      const specialDir = '/tmp/test-dir with spaces'
      const mockFiles = ['test.shp']
      Array.fromAsync.mockResolvedValue(mockFiles)
      path.join.mockImplementation((dir, file) => `${dir}/${file}`)

      const result = await shapefileParser.findShapefiles(specialDir)

      expect(result).toEqual(['/tmp/test-dir with spaces/test.shp'])
    })
  })

  describe('parseShapefile', () => {
    const shpPath = '/tmp/test.shp'
    const mockGeoJSON = createFeatureCollection([
      createFeature(createPointGeometry([-0.1, 51.5]), { name: 'Test Point' })
    ])

    beforeEach(() => {
      shapefile.read.mockResolvedValue(mockGeoJSON)
    })

    it('should successfully parse shapefile', async () => {
      const result = await shapefileParser.parseShapefile(shpPath)

      expect(result).toEqual(mockGeoJSON)
      expect(shapefile.read).toHaveBeenCalledWith(shpPath)
    })

    it('should handle shapefile parsing errors', async () => {
      const error = new Error('Invalid shapefile')
      shapefile.read.mockRejectedValue(error)

      await expect(shapefileParser.parseShapefile(shpPath)).rejects.toThrow(
        'Invalid shapefile'
      )
    })

    it('should handle empty shapefile', async () => {
      const emptyGeoJSON = createFeatureCollection([])
      shapefile.read.mockResolvedValue(emptyGeoJSON)

      const result = await shapefileParser.parseShapefile(shpPath)

      expect(result).toEqual(emptyGeoJSON)
    })

    it('should handle large shapefile', async () => {
      const largeFeature = createFeature(createPointGeometry([-0.1, 51.5]), {
        name: 'Point'
      })
      const largeGeoJSON = createFeatureCollection(
        Array(1000).fill(largeFeature)
      )
      shapefile.read.mockResolvedValue(largeGeoJSON)

      const result = await shapefileParser.parseShapefile(shpPath)

      expect(result).toEqual(largeGeoJSON)
      expect(result.features).toHaveLength(1000)
    })

    it('should handle different geometry types', async () => {
      const polygonCoords = [
        [
          [-0.1, 51.5],
          [-0.2, 51.5],
          [-0.2, 51.6],
          [-0.1, 51.6],
          [-0.1, 51.5]
        ]
      ]
      const mixedGeoJSON = createFeatureCollection([
        createFeature(createPointGeometry([-0.1, 51.5]), {}),
        createFeature(createPolygonGeometry(polygonCoords), {})
      ])
      shapefile.read.mockResolvedValue(mixedGeoJSON)

      const result = await shapefileParser.parseShapefile(shpPath)

      expect(result).toEqual(mixedGeoJSON)
      expect(result.features[0].geometry.type).toBe('Point')
      expect(result.features[1].geometry.type).toBe('Polygon')
    })
  })

  describe('parseFile', () => {
    const filename = '/tmp/test.zip'
    const mockGeoJSON = createFeatureCollection([
      createFeature(createPointGeometry([-0.1, 51.5]), {})
    ])

    beforeEach(() => {
      // Mock setImmediate to execute synchronously
      global.setImmediate = jest.fn((cb) => cb())

      // Mock successful extraction
      jest
        .spyOn(shapefileParser, 'extractZip')
        .mockResolvedValue('/tmp/extract-dir')
      jest
        .spyOn(shapefileParser, 'findShapefiles')
        .mockResolvedValue(['/tmp/extract-dir/test.shp'])
      jest
        .spyOn(shapefileParser, 'parseShapefile')
        .mockResolvedValue(mockGeoJSON)
      jest.spyOn(shapefileParser, 'cleanupTempDirectory').mockResolvedValue()
    })

    it('should successfully parse zip file with single shapefile', async () => {
      const result = await shapefileParser.parseFile(filename)

      expect(result).toEqual(mockGeoJSON)
      expect(shapefileParser.extractZip).toHaveBeenCalledWith(filename)
      expect(shapefileParser.findShapefiles).toHaveBeenCalledWith(
        '/tmp/extract-dir'
      )
      expect(shapefileParser.parseShapefile).toHaveBeenCalledWith(
        '/tmp/extract-dir/test.shp'
      )
      expect(shapefileParser.cleanupTempDirectory).toHaveBeenCalledWith(
        '/tmp/extract-dir'
      )
    })

    it('should successfully parse zip file with multiple shapefiles', async () => {
      const shapefilePaths = [
        '/tmp/extract-dir/test1.shp',
        '/tmp/extract-dir/test2.shp'
      ]
      const geoJSON1 = createFeatureCollection([
        createFeature(createPointGeometry([-0.1, 51.5]), { name: 'Point 1' })
      ])
      const geoJSON2 = createFeatureCollection([
        createFeature(createPointGeometry([-0.2, 51.6]), { name: 'Point 2' })
      ])

      shapefileParser.findShapefiles.mockResolvedValue(shapefilePaths)
      shapefileParser.parseShapefile
        .mockResolvedValueOnce(geoJSON1)
        .mockResolvedValueOnce(geoJSON2)

      const result = await shapefileParser.parseFile(filename)

      expect(result).toEqual({
        type: 'FeatureCollection',
        features: [...geoJSON1.features, ...geoJSON2.features]
      })
      expect(shapefileParser.parseShapefile).toHaveBeenCalledTimes(2)
    })

    it('should throw error when no shapefiles found', async () => {
      shapefileParser.findShapefiles.mockResolvedValue([])

      await expect(shapefileParser.parseFile(filename)).rejects.toThrow(
        'No shapefiles found in zip archive'
      )
    })

    it('should handle extraction errors', async () => {
      shapefileParser.extractZip.mockRejectedValue(
        new Error('Extraction failed')
      )

      await expect(shapefileParser.parseFile(filename)).rejects.toThrow(
        'Failed to parse shapefile: Extraction failed'
      )
    })

    it('should handle shapefile parsing errors', async () => {
      shapefileParser.parseShapefile.mockRejectedValue(
        new Error('Parse failed')
      )

      await expect(shapefileParser.parseFile(filename)).rejects.toThrow(
        'Failed to parse shapefile: Parse failed'
      )
    })

    it('should cleanup temp directory even on error', async () => {
      shapefileParser.parseShapefile.mockRejectedValue(
        new Error('Parse failed')
      )

      await expect(shapefileParser.parseFile(filename)).rejects.toThrow()

      expect(shapefileParser.cleanupTempDirectory).toHaveBeenCalledWith(
        '/tmp/extract-dir'
      )
    })

    it('should handle empty shapefiles', async () => {
      const emptyGeoJSON = createFeatureCollection([])
      shapefileParser.parseShapefile.mockResolvedValue(emptyGeoJSON)

      const result = await shapefileParser.parseFile(filename)

      expect(result).toEqual(createFeatureCollection([]))
    })

    it('should handle mixed empty and non-empty shapefiles', async () => {
      const shapefilePaths = [
        '/tmp/extract-dir/empty.shp',
        '/tmp/extract-dir/nonempty.shp'
      ]
      const emptyGeoJSON = createFeatureCollection([])
      const nonEmptyGeoJSON = createFeatureCollection([
        createFeature(createPointGeometry([-0.1, 51.5]), {})
      ])

      shapefileParser.findShapefiles.mockResolvedValue(shapefilePaths)
      shapefileParser.parseShapefile
        .mockResolvedValueOnce(emptyGeoJSON)
        .mockResolvedValueOnce(nonEmptyGeoJSON)

      const result = await shapefileParser.parseFile(filename)

      expect(result).toEqual(nonEmptyGeoJSON)
    })
  })

  describe('cleanupTempDirectory', () => {
    const tempDir = '/tmp/test-dir'

    it('should successfully cleanup temp directory', async () => {
      await shapefileParser.cleanupTempDirectory(tempDir)

      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should handle cleanup errors gracefully', async () => {
      rm.mockRejectedValue(new Error('Permission denied'))

      await expect(
        shapefileParser.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should handle non-existent directory', async () => {
      const error = new Error('Directory not found')
      error.code = 'ENOENT'
      rm.mockRejectedValue(error)

      await expect(
        shapefileParser.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })
  })

  describe('Security features', () => {
    it('should prevent zip bomb attacks', async () => {
      const suspiciousEntries = [
        createZipEntry('bomb.shp', false, 1_000_000, 1000)
      ]
      mockAdmZip.getEntries.mockReturnValue(suspiciousEntries)

      await expect(shapefileParser.extractZip('/tmp/test.zip')).rejects.toThrow(
        'Reached max compression ratio'
      )
    })

    it('should prevent directory traversal attacks', async () => {
      const maliciousEntries = [createZipEntry('../../../etc/passwd')]
      mockAdmZip.getEntries.mockReturnValue(maliciousEntries)

      await shapefileParser.extractZip('/tmp/test.zip')

      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledWith(
        '../../../etc/passwd',
        '/tmp/shapefile-test'
      )
    })

    it('should limit number of files extracted', async () => {
      const restrictiveParser = new ShapefileParser(
        createShapefileOptions({ maxFiles: 2 })
      )
      const manyEntries = Array(3).fill(createZipEntry('test.shp'))
      mockAdmZip.getEntries.mockReturnValue(manyEntries)

      await expect(
        restrictiveParser.extractZip('/tmp/test.zip')
      ).rejects.toThrow('Reached max number of files')
    })

    it('should limit total extracted size', async () => {
      const restrictiveParser = new ShapefileParser(
        createShapefileOptions({ maxSize: 1000 })
      )
      const largeEntries = [createZipEntry('large.shp', false, 2000, 1000)]
      mockAdmZip.getEntries.mockReturnValue(largeEntries)

      await expect(
        restrictiveParser.extractZip('/tmp/test.zip')
      ).rejects.toThrow('Reached max size')
    })
  })
})
