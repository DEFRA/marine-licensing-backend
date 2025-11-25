import { vi, expect } from 'vitest'
import { join } from 'node:path'
import * as fs from 'node:fs/promises'
import AdmZip from 'adm-zip'
import proj4 from 'proj4'
import * as shapefile from 'shapefile'

import { ShapefileParser } from './shapefile-parser.js'
import { createLogger } from '../../common/helpers/logging/logger.js'

vi.mock('node:fs/promises')
vi.mock('../../common/helpers/logging/logger.js', () => {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
  return {
    createLogger: vi.fn(() => logger),
    structureErrorForECS: vi.fn((error) => ({
      error: {
        message: error?.message || String(error),
        stack_trace: error?.stack,
        type: error?.name || error?.constructor?.name || 'Error',
        code: error?.code || error?.statusCode
      }
    }))
  }
})

vi.mock('adm-zip')
vi.mock('shapefile')

const logger = createLogger()

const pointFeature = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-0.1, 51.5]
  },
  properties: {}
}

const polygonFeature = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-0.1, 51.5],
        [-0.2, 51.5],
        [-0.2, 51.6],
        [-0.1, 51.6],
        [-0.1, 51.5]
      ]
    ]
  },
  properties: {}
}

async function* createAsyncIterable(array) {
  yield* array
}

describe('ShapefileParser class', () => {
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const parser = new ShapefileParser()

      expect(parser.options).toEqual({
        maxFiles: 10_000,
        maxSize: 1_000_000_000,
        thresholdRatio: 175
      })
    })

    it('should initialize with custom options', () => {
      const customOptions = {
        maxFiles: 5_000,
        maxSize: 500_000_000,
        thresholdRatio: 5
      }
      const parser = new ShapefileParser(customOptions)
      expect(parser.options).toEqual(customOptions)
    })

    it('should merge custom options with defaults', () => {
      const customOptions = {
        maxFiles: 5_000
      }

      const parser = new ShapefileParser(customOptions)

      expect(parser.options).toEqual({
        maxFiles: 5_000,
        maxSize: 1_000_000_000,
        thresholdRatio: 175
      })
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
      const customOptions = {
        maxFiles: 5_000,
        maxSize: 500_000_000,
        thresholdRatio: 5
      }
      const parser = new ShapefileParser(customOptions)
      const options = parser.getSafeOptions()
      expect(options).toEqual(customOptions)
    })
  })

  describe('extractZip', () => {
    const zipPath = '/tmp/test.zip'
    let sut
    let mockAdmZip
    const mockZipEntries = [
      {
        entryName: 'test.shp',
        isDirectory: false,
        getData: () => Buffer.alloc(1000),
        header: { compressedSize: 500 }
      },
      {
        entryName: 'test.shx',
        isDirectory: false,
        getData: () => Buffer.alloc(100),
        header: { compressedSize: 50 }
      },
      {
        entryName: 'test.dbf',
        isDirectory: false,
        getData: () => Buffer.alloc(200),
        header: { compressedSize: 100 }
      }
    ]

    const mockFileEntries = [
      {
        name: 'test.shp',
        path: '/tmp/mock-dir-123',
        isFile: () => true
      },
      {
        name: 'test.shx',
        path: '/tmp/mock-dir-123',
        isFile: () => true
      },
      {
        name: 'test.dbf',
        path: '/tmp/mock-dir-123',
        isFile: () => true
      },
      {
        name: 'test.prj',
        path: '/tmp/mock-dir-123',
        isFile: () => true
      }
    ]

    beforeEach(() => {
      mockAdmZip = {
        getEntries: vi.fn().mockReturnValue(mockZipEntries),
        extractEntryTo: vi.fn()
      }
      AdmZip.mockImplementation(() => mockAdmZip)
      fs.mkdtemp.mockResolvedValue('/tmp/mock-dir-123')
      fs.readdir.mockResolvedValue(mockFileEntries)
      fs.stat.mockResolvedValue({ size: 100 })
      sut = new ShapefileParser()
    })

    it('should construct a new Adm-Zip instance', async () => {
      await sut.extractZip(zipPath)
      expect(AdmZip).toHaveBeenCalledTimes(1)
    })

    it('should successfully extract zip file', async () => {
      const result = await sut.extractZip(zipPath)
      expect(result).toBe('/tmp/mock-dir-123')
      expect(fs.mkdtemp).toHaveBeenCalledWith(
        expect.stringMatching(/shapefile-$/)
      )
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
      await sut.extractZip(zipPath)
      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledTimes(3) // Still only 3 files
    })

    it('should throw error when exceeding max files limit', async () => {
      const manyEntries = Array(10001).fill({
        entryName: 'test.shp',
        isDirectory: false,
        getData: () => Buffer.alloc(100),
        header: { compressedSize: 50 }
      })
      mockAdmZip.getEntries.mockReturnValue(manyEntries)

      await expect(sut.extractZip(zipPath)).rejects.toThrow(
        'Reached max number of files'
      )
    })

    it('should throw error when exceeding max size limit', async () => {
      const largeEntries = [
        {
          entryName: 'large.shp',
          isDirectory: false,
          getData: () => Buffer.alloc(2_000_000_000), // 2GB
          header: { compressedSize: 1_000_000_000 }
        }
      ]
      mockAdmZip.getEntries.mockReturnValue(largeEntries)

      await expect(sut.extractZip(zipPath)).rejects.toThrow('Reached max size')
    })

    it('should throw error when exceeding compression ratio limit', async () => {
      const suspiciousEntries = [
        {
          entryName: 'suspicious.shp',
          isDirectory: false,
          getData: () => Buffer.alloc(99_999),
          header: { compressedSize: 568 } // 176 compression ration > 175
        }
      ]
      mockAdmZip.getEntries.mockReturnValue(suspiciousEntries)
      await expect(sut.extractZip(zipPath)).rejects.toThrow(
        'Reached max compression ratio'
      )
    })

    it('should handle AdmZip errors', async () => {
      AdmZip.mockImplementation(() => {
        throw new Error('Invalid zip file')
      })
      await expect(sut.extractZip(zipPath)).rejects.toThrow('Invalid zip file')
    })

    it('should handle mkdtemp errors', async () => {
      fs.mkdtemp.mockRejectedValue(new Error('Permission denied'))
      await expect(sut.extractZip(zipPath)).rejects.toThrow('Permission denied')
    })

    it('should handle extraction errors', async () => {
      mockAdmZip.extractEntryTo.mockImplementation(() => {
        throw new Error('Extraction failed')
      })
      await expect(sut.extractZip(zipPath)).rejects.toThrow('Extraction failed')
    })

    it('should handle empty zip file', async () => {
      mockAdmZip.getEntries.mockReturnValue([])
      fs.readdir.mockResolvedValue([])
      await expect(sut.extractZip(zipPath)).rejects.toThrow(
        'SHAPEFILE_MISSING_CORE_FILES'
      )
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
          entryName: 'test.SHX',
          isDirectory: false,
          getData: () => Buffer.alloc(100),
          header: { compressedSize: 50 }
        },
        {
          entryName: 'test.DBF',
          isDirectory: false,
          getData: () => Buffer.alloc(200),
          header: { compressedSize: 100 }
        },
        {
          entryName: 'test.PRJ',
          isDirectory: false,
          getData: () => Buffer.alloc(100),
          header: { compressedSize: 50 }
        },
        {
          entryName: 'readme.txt',
          isDirectory: false,
          getData: () => Buffer.alloc(100),
          header: { compressedSize: 50 }
        }
      ]
      const mixedFileEntries = [
        {
          name: 'test.SHP',
          path: '/tmp/mock-dir-123',
          isFile: () => true
        },
        {
          name: 'test.SHX',
          path: '/tmp/mock-dir-123',
          isFile: () => true
        },
        {
          name: 'test.DBF',
          path: '/tmp/mock-dir-123',
          isFile: () => true
        },
        {
          name: 'test.PRJ',
          path: '/tmp/mock-dir-123',
          isFile: () => true
        },
        {
          name: 'readme.txt',
          path: '/tmp/mock-dir-123',
          isFile: () => true
        }
      ]
      mockAdmZip.getEntries.mockReturnValue(mixedEntries)
      fs.readdir.mockResolvedValue(mixedFileEntries)
      await sut.extractZip(zipPath)
      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledTimes(5)
    })
  })

  describe('validateShapefileContents', () => {
    const tempDir = '/tmp/mock-dir-456'
    let sut

    const validFileEntries = [
      {
        name: 'test.shp',
        path: tempDir,
        isFile: () => true
      },
      {
        name: 'test.shx',
        path: tempDir,
        isFile: () => true
      },
      {
        name: 'test.dbf',
        path: tempDir,
        isFile: () => true
      },
      {
        name: 'test.prj',
        path: tempDir,
        isFile: () => true
      }
    ]

    beforeEach(() => {
      sut = new ShapefileParser()
      fs.stat.mockResolvedValue({ size: 500 })
    })

    it('validates successfully with all required files', async () => {
      fs.readdir.mockResolvedValue(validFileEntries)

      await expect(
        sut.validateShapefileContents(tempDir)
      ).resolves.toBeUndefined()
    })

    it('throws SHAPEFILE_MISSING_CORE_FILES when .shp file is missing', async () => {
      const entries = validFileEntries.filter((f) => f.name !== 'test.shp')
      fs.readdir.mockResolvedValue(entries)

      await expect(sut.validateShapefileContents(tempDir)).rejects.toThrow(
        'SHAPEFILE_MISSING_CORE_FILES'
      )
    })

    it('throws SHAPEFILE_MISSING_CORE_FILES when .shx file is missing', async () => {
      const entries = validFileEntries.filter((f) => f.name !== 'test.shx')
      fs.readdir.mockResolvedValue(entries)

      await expect(sut.validateShapefileContents(tempDir)).rejects.toThrow(
        'SHAPEFILE_MISSING_CORE_FILES'
      )
    })

    it('throws SHAPEFILE_MISSING_CORE_FILES when .dbf file is missing', async () => {
      const entries = validFileEntries.filter((f) => f.name !== 'test.dbf')
      fs.readdir.mockResolvedValue(entries)

      await expect(sut.validateShapefileContents(tempDir)).rejects.toThrow(
        'SHAPEFILE_MISSING_CORE_FILES'
      )
    })

    it('throws SHAPEFILE_MISSING_CORE_FILES when all core files are missing', async () => {
      const entries = validFileEntries.filter((f) => f.name === 'test.prj')
      fs.readdir.mockResolvedValue(entries)

      await expect(sut.validateShapefileContents(tempDir)).rejects.toThrow(
        'SHAPEFILE_MISSING_CORE_FILES'
      )
    })

    it('throws SHAPEFILE_MISSING_PRJ_FILE when .prj file is missing', async () => {
      const entries = validFileEntries.filter((f) => f.name !== 'test.prj')
      fs.readdir.mockResolvedValue(entries)

      await expect(sut.validateShapefileContents(tempDir)).rejects.toThrow(
        'SHAPEFILE_MISSING_PRJ_FILE'
      )
    })

    it('throws SHAPEFILE_PRJ_FILE_TOO_LARGE when .prj file exceeds 50KB', async () => {
      fs.readdir.mockResolvedValue(validFileEntries)
      fs.stat.mockResolvedValue({ size: 50_001 })

      await expect(sut.validateShapefileContents(tempDir)).rejects.toThrow(
        'SHAPEFILE_PRJ_FILE_TOO_LARGE'
      )
    })

    it('validates successfully when .prj file is exactly 50KB', async () => {
      fs.readdir.mockResolvedValue(validFileEntries)
      fs.stat.mockResolvedValue({ size: 50_000 })

      await expect(
        sut.validateShapefileContents(tempDir)
      ).resolves.toBeUndefined()
    })

    it('validates case-insensitive file extensions', async () => {
      const entries = [
        { name: 'test.SHP', path: tempDir, isFile: () => true },
        { name: 'test.ShX', path: tempDir, isFile: () => true },
        { name: 'test.DBF', path: tempDir, isFile: () => true },
        { name: 'test.PrJ', path: tempDir, isFile: () => true }
      ]
      fs.readdir.mockResolvedValue(entries)

      await expect(
        sut.validateShapefileContents(tempDir)
      ).resolves.toBeUndefined()
    })

    it('validates successfully with files in subdirectories', async () => {
      const entries = validFileEntries.map((f) => ({
        ...f,
        path: join(tempDir, 'subdir')
      }))
      fs.readdir.mockResolvedValue(entries)

      await expect(
        sut.validateShapefileContents(tempDir)
      ).resolves.toBeUndefined()
    })

    it('throws when multiple .prj files and one exceeds size limit', async () => {
      const entries = [
        ...validFileEntries,
        { name: 'test2.prj', path: tempDir, isFile: () => true }
      ]
      fs.readdir.mockResolvedValue(entries)
      fs.stat
        .mockResolvedValueOnce({ size: 500 })
        .mockResolvedValueOnce({ size: 60_000 })

      await expect(sut.validateShapefileContents(tempDir)).rejects.toThrow(
        'SHAPEFILE_PRJ_FILE_TOO_LARGE'
      )
    })

    it('validates successfully with multiple valid .prj files', async () => {
      const entries = [
        ...validFileEntries,
        { name: 'test2.prj', path: tempDir, isFile: () => true }
      ]
      fs.readdir.mockResolvedValue(entries)
      fs.stat.mockResolvedValue({ size: 1000 })

      await expect(
        sut.validateShapefileContents(tempDir)
      ).resolves.toBeUndefined()
    })

    it('ignores non-file entries when validating', async () => {
      const entries = [
        ...validFileEntries,
        { name: 'folder', path: tempDir, isFile: () => false }
      ]
      fs.readdir.mockResolvedValue(entries)

      await expect(
        sut.validateShapefileContents(tempDir)
      ).resolves.toBeUndefined()
    })

    it('validates with additional non-shapefile files present', async () => {
      const entries = [
        ...validFileEntries,
        { name: 'readme.txt', path: tempDir, isFile: () => true },
        { name: 'metadata.xml', path: tempDir, isFile: () => true }
      ]
      fs.readdir.mockResolvedValue(entries)

      await expect(
        sut.validateShapefileContents(tempDir)
      ).resolves.toBeUndefined()
    })
  })

  describe('findShapefiles', () => {
    const directory = '/tmp/mock-dir-234'
    let sut
    const mockFiles = ['mock.shp', 'mock.prj', 'mock.dbf']

    beforeEach(() => {
      fs.glob.mockImplementation(() => createAsyncIterable(mockFiles))
      sut = new ShapefileParser()
    })

    it('calls glob look for *.shp files', async () => {
      const result = await sut.findShapefiles(directory)
      expect(result).toEqual([
        '/tmp/mock-dir-234/mock.shp',
        '/tmp/mock-dir-234/mock.prj',
        '/tmp/mock-dir-234/mock.dbf'
      ])
      expect(fs.glob).toHaveBeenCalledWith('**/*.[sS][hH][pP]', {
        cwd: directory
      })
    })

    it('should return empty array when no shapefiles found', async () => {
      fs.glob.mockImplementation(() => createAsyncIterable([]))
      const result = await sut.findShapefiles(directory)
      expect(result).toEqual([])
    })

    it('should handle glob errors', async () => {
      fs.glob.mockImplementation(() => {
        throw new Error('Glob error')
      })
      const result = await sut.findShapefiles(directory)
      expect(result).toEqual([])
    })
  })

  describe('transformCoordinates', () => {
    const crsOsgb34 =
      'PROJCS["British_National_Grid",GEOGCS["GCS_OSGB_1936",DATUM["D_OSGB_1936",SPHEROID["Airy_1830",6377563.396,299.3249646]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",400000.0],PARAMETER["False_Northing",-100000.0],PARAMETER["Central_Meridian",-2.0],PARAMETER["Scale_Factor",0.9996012717],PARAMETER["Latitude_Of_Origin",49.0],UNIT["Meter",1.0]]'
    const crsWgs84 =
      'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'
    const targetCRS = 'EPSG:4326'
    let sut

    beforeEach(() => {
      sut = new ShapefileParser()
    })

    it('transforms OSGB34 to WGS84 CRS', () => {
      const transformer = proj4(crsOsgb34, targetCRS)
      const coords = [513967, 476895]
      sut.transformCoordinates(coords, transformer)
      expect(coords[0]).toBe(-0.25548579983960573)
      expect(coords[1]).toBe(54.17519536505793)
    })

    it('no-ops WGS84 sources', () => {
      const transformer = proj4(crsWgs84, targetCRS)
      const coords = [-0.255485, 54.175195]
      sut.transformCoordinates(coords, transformer)
      expect(coords[0]).toBe(-0.255485)
      expect(coords[1]).toBe(54.175195)
    })

    it('short circuits when no coordinates are given', async () => {
      const transformer = proj4(crsOsgb34, targetCRS)
      const coords = null
      sut.transformCoordinates(coords, transformer)
      expect(coords).toBe(null)
    })

    it('short circuits when coordinates are not an array', async () => {
      const transformer = proj4(crsOsgb34, targetCRS)
      const coords = {}
      sut.transformCoordinates(coords, transformer)
      expect(coords).toStrictEqual({})
    })

    it('short circuits when coordinates are an empty array', async () => {
      const transformer = proj4(crsOsgb34, targetCRS)
      const coords = []
      sut.transformCoordinates(coords, transformer)
      expect(coords).toStrictEqual([])
    })

    it('transforms nested coordinates', async () => {
      const transformer = proj4(crsOsgb34, targetCRS)
      const coords = [
        [513967, 476895],
        [514040, 476693],
        [514193, 476835]
      ]
      sut.transformCoordinates(coords, transformer)
      expect(coords).toStrictEqual([
        [-0.25548579983960573, 54.17519536505793],
        [-0.25444440662018697, 54.17336455859773],
        [-0.2520479149715545, 54.17460619526199]
      ])
    })

    it('ignores infinities', () => {
      const mockTransformer = {
        forward: () => {
          return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
        }
      }
      const coords = [1, 2]
      sut.transformCoordinates(coords, mockTransformer)
      expect(coords[0]).toBe(1) // untouched by infinity
      expect(coords[1]).toBe(2)
    })

    it('no-ops when there are not enough coordinates to transform', () => {
      const transformer = proj4(crsWgs84, targetCRS)
      const coords = [-0.255485] // missing a coordinate
      sut.transformCoordinates(coords, transformer)
      expect(coords[0]).toBe(-0.255485)
      expect(coords[1]).toBeUndefined()
    })

    it('throws an error if the transformed longitude coordinates are less than -180', () => {
      const mockTransformer = {
        forward: () => {
          return [-181, 0]
        }
      }
      const coords = [1, 2]
      expect(() => sut.transformCoordinates(coords, mockTransformer)).toThrow(
        'Invalid longitude received: -181 from proj4 transformation'
      )
    })

    it('throws an error if the transformed longitude coordinates are greater than 180', () => {
      const mockTransformer = {
        forward: () => {
          return [181, 0]
        }
      }
      const coords = [1, 2]
      expect(() => sut.transformCoordinates(coords, mockTransformer)).toThrow(
        'Invalid longitude received: 181 from proj4 transformation'
      )
    })

    it('throws an error if the transformed latitude coordinates are less than 90', () => {
      const mockTransformer = {
        forward: () => {
          return [0, -90.01]
        }
      }
      const coords = [1, 2]
      expect(() => sut.transformCoordinates(coords, mockTransformer)).toThrow(
        'Invalid latitude received: -90.01 from proj4 transformation'
      )
    })

    it('throws an error if the transformed latitude coordinates are greater than 90', () => {
      const mockTransformer = {
        forward: () => {
          return [0, 90.01]
        }
      }
      const coords = [1, 2]
      expect(() => sut.transformCoordinates(coords, mockTransformer)).toThrow(
        'Invalid latitude received: 90.01 from proj4 transformation'
      )
    })
  })

  describe('parseShapefile', () => {
    const shpPath = '/tmp/mock-dir-345/test.shp'
    const mockGeoJSON = {
      type: 'FeatureCollection',
      features: [pointFeature]
    }
    let sut
    const nullTransformer = null
    const mockRealTransformer = 'mocked'

    beforeEach(() => {
      const mockRead = vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: pointFeature })
        .mockResolvedValueOnce({ done: true, value: undefined })

      shapefile.open.mockResolvedValue({
        read: mockRead
      })
      sut = new ShapefileParser()
    })

    it('should successfully parse a valid shapefile', async () => {
      const result = await sut.parseShapefile(shpPath, nullTransformer)
      expect(result).toEqual(mockGeoJSON)
      expect(shapefile.open).toHaveBeenCalledWith(shpPath)
    })

    it('should transform the coordinated if a real transformer is given', async () => {
      vi.spyOn(sut, 'transformCoordinates').mockResolvedValue(pointFeature)
      const result = await sut.parseShapefile(shpPath, mockRealTransformer)
      expect(sut.transformCoordinates).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockGeoJSON)
    })

    it('should parse multiple features in the shapefile', async () => {
      const multipleMockRead = vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: pointFeature })
        .mockResolvedValueOnce({ done: false, value: polygonFeature })
        .mockResolvedValueOnce({ done: true, value: undefined })

      shapefile.open.mockResolvedValue({
        read: multipleMockRead
      })
      const result = await sut.parseShapefile(shpPath, null)
      expect(result.features).toHaveLength(2)
    })

    it('should throw shapefile parsing errors', async () => {
      const error = new Error('Invalid shapefile')
      shapefile.open.mockRejectedValue(error)
      await expect(sut.parseShapefile(shpPath)).rejects.toThrow(
        'Invalid shapefile'
      )
    })

    it('should ignore features with null geometry and only return valid features', async () => {
      const validFeature = pointFeature
      const invalidFeature = {
        type: 'Feature',
        geometry: null,
        properties: {}
      }

      const mockRead = vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: validFeature })
        .mockResolvedValueOnce({ done: false, value: invalidFeature })
        .mockResolvedValueOnce({ done: true, value: undefined })

      shapefile.open.mockResolvedValue({
        read: mockRead
      })

      const result = await sut.parseShapefile(shpPath, nullTransformer)

      expect(result.features).toHaveLength(1)
      expect(result.features[0]).toEqual(validFeature)
      expect(logger.warn).toHaveBeenCalledWith(
        { feature: invalidFeature },
        expect.stringContaining('Ignoring feature without geometry.coordinates')
      )
    })
  })

  describe('findProjectionFile', () => {
    const directory = '/tmp/mock-dir-567'
    let sut
    const mockFiles = ['mock.prj']
    const basename = 'mock'

    beforeEach(() => {
      fs.glob.mockImplementation(() => createAsyncIterable(mockFiles))
      sut = new ShapefileParser()
    })

    it('returns null if basename is not provided', async () => {
      const result = await sut.findProjectionFile(directory)
      expect(result).toBeNull()
    })

    it('calls glob look for *.prj files', async () => {
      const result = await sut.findProjectionFile(directory, basename)
      expect(result).toEqual('/tmp/mock-dir-567/mock.prj')
      expect(fs.glob).toHaveBeenCalledWith('**/mock.[pP][rR][jJ]', {
        cwd: directory
      })
    })

    it('should return null when no *.prj found', async () => {
      fs.glob.mockImplementationOnce(() => createAsyncIterable([]))
      const result = await sut.findProjectionFile(directory, 'proj-not-found')
      expect(result).toBeNull()
    })

    it('should handle glob errors', async () => {
      fs.glob.mockImplementation(() => {
        throw new Error('Glob error')
      })
      const result = await sut.findProjectionFile(directory, 'mock')
      expect(result).toBe(null)
    })

    it('returns the first projection file if there is more than one', async () => {
      const mockMultipleFiles = ['project1.prj', 'project1.PRJ']
      fs.glob.mockImplementation(() => createAsyncIterable(mockMultipleFiles))
      const result = await sut.findProjectionFile(directory, 'project1')
      expect(result).toBe('/tmp/mock-dir-567/project1.prj')
    })
  })

  describe('readProjectionFile', () => {
    let sut
    const directory = '/tmp/mock-dir-789'
    const mockPrjFileContent = 'MOCK:PROJFILE'
    beforeEach(() => {
      fs.stat.mockResolvedValue({
        size: 100
      })
      fs.readFile.mockResolvedValue(mockPrjFileContent)
      sut = new ShapefileParser()
      vi.spyOn(sut, 'findProjectionFile').mockResolvedValue(
        `${directory}/project1.prj`
      )
    })

    it('calls findProjectionFile to find the path to the projection file', async () => {
      const result = await sut.readProjectionFile(
        '/tmp/mock-dir-789/project.prj'
      )
      expect(result).toEqual(mockPrjFileContent)
    })

    it('returns null when the proj file is not found in the given directory', async () => {
      vi.spyOn(sut, 'findProjectionFile').mockResolvedValue(null)
      const result = await sut.readProjectionFile(directory)
      expect(result).toBeNull()
    })

    it('reads the projection file content', async () => {
      const result = await sut.readProjectionFile(directory)
      expect(result).toBe(mockPrjFileContent)
      expect(fs.readFile).toHaveBeenCalledWith(
        `${directory}/project1.prj`,
        'utf-8'
      )
    })
  })

  describe('createTransformer', () => {
    let sut
    const crsOsgb34 =
      'PROJCS["British_National_Grid",GEOGCS["GCS_OSGB_1936",DATUM["D_OSGB_1936",SPHEROID["Airy_1830",6377563.396,299.3249646]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",400000.0],PARAMETER["False_Northing",-100000.0],PARAMETER["Central_Meridian",-2.0],PARAMETER["Scale_Factor",0.9996012717],PARAMETER["Latitude_Of_Origin",49.0],UNIT["Meter",1.0]]'
    beforeEach(() => {
      sut = new ShapefileParser()
    })

    it('returns null if the CRS WKT content was null', () => {
      expect(sut.createTransformer(null)).toBeNull()
    })

    it('creates a transformer with target CRS as WGS84', () => {
      const transformer = sut.createTransformer(crsOsgb34)
      expect(transformer).not.toBeNull()
      expect(transformer).toHaveProperty('forward')
      expect(transformer).toHaveProperty('inverse')
      const testCoord = [513967, 476895]
      const result = transformer.forward(testCoord)
      expect(result[0]).toBeCloseTo(-0.255, 2)
      expect(result[1]).toBeCloseTo(54.175, 2)
    })

    it('returns null if the proj4 call errors out', () => {
      const invalidCRS = 'INVALID_CRS_STRING'
      const result = sut.createTransformer(invalidCRS)
      expect(result).toBeNull()
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('parseFile', () => {
    const filename = '/tmp/test.zip'

    const mockTmpDir = '/tmp/mock-extract-dir'
    const mockShapefileA = join(mockTmpDir, 'project-a-name.shp')
    const mockShapefileB = join(mockTmpDir, 'project-b-name.shp')
    let sut

    beforeEach(() => {
      const wsg84Projection = 'MOCK:WSG84:CRS'
      sut = new ShapefileParser()
      vi.spyOn(sut, 'extractZip').mockResolvedValue(mockTmpDir)
      vi.spyOn(sut, 'findShapefiles').mockResolvedValue([mockShapefileA])
      vi.spyOn(sut, 'readProjectionFile').mockResolvedValue(wsg84Projection)
      vi.spyOn(sut, 'createTransformer').mockReturnValue(null)
      vi.spyOn(sut, 'parseShapefile').mockResolvedValue({
        type: 'FeatureCollection',
        features: [pointFeature]
      })
      vi.spyOn(sut, 'cleanupTempDirectory').mockResolvedValue()
    })

    it('should decompress the zip file', async () => {
      await sut.parseFile(filename)
      expect(sut.extractZip).toHaveBeenCalledTimes(1)
    })

    it('it assembles all features into a feature collection', async () => {
      vi.spyOn(sut, 'parseShapefile').mockResolvedValue({
        type: 'FeatureCollection',
        features: [pointFeature, polygonFeature]
      })
      const result = await sut.parseFile(filename)
      expect(result.type).toBe('FeatureCollection')
      expect(result.features.length).toBe(2)
      expect(result.features[0]).toEqual(pointFeature)
      expect(result.features[1]).toEqual(polygonFeature)
    })

    it('edge case: it should find multiple shapefiles', async () => {
      vi.spyOn(sut, 'findShapefiles').mockResolvedValue([
        mockShapefileA,
        mockShapefileB
      ])
      await sut.parseFile(filename)
      expect(sut.parseShapefile).toHaveBeenCalledTimes(2)
    })

    it('throws an error if no shapefile was found', async () => {
      vi.spyOn(sut, 'findShapefiles').mockResolvedValue([])
      await expect(sut.parseFile(filename)).rejects.toThrow(
        'SHAPEFILE_NOT_FOUND'
      )
    })

    it('it cleans up the zip extract directory', async () => {
      await sut.parseFile(filename)
      await new Promise((resolve) => setImmediate(resolve))
      expect(sut.cleanupTempDirectory).toHaveBeenCalledTimes(1)
      expect(sut.cleanupTempDirectory).toHaveBeenCalledWith(mockTmpDir)
    })

    it('wraps non-GeoParserErrorCode errors with descriptive message', async () => {
      const genericError = new Error('Disk full')
      vi.spyOn(sut, 'parseShapefile').mockRejectedValue(genericError)

      await expect(sut.parseFile(filename)).rejects.toThrow(
        'Failed to parse shapefile: Disk full'
      )
    })

    it('re-throws GeoParserErrorCode errors without wrapping', async () => {
      const geoParserError = new Error('SHAPEFILE_MISSING_CORE_FILES')
      vi.spyOn(sut, 'extractZip').mockRejectedValue(geoParserError)

      await expect(sut.parseFile(filename)).rejects.toThrow(
        'SHAPEFILE_MISSING_CORE_FILES'
      )
    })
  })

  describe('cleanupTempDirectory', () => {
    let sut

    beforeEach(() => {
      sut = new ShapefileParser()
    })

    it('should call rm to remove the directory', async () => {
      const tempDir = '/tmp/mock-dir'
      await sut.cleanupTempDirectory(tempDir)
      expect(fs.rm).toHaveBeenCalledTimes(1)
      expect(fs.rm).toHaveBeenCalledWith(tempDir, {
        recursive: true,
        force: true
      })
    })

    it('should not throw when cleanup fails', async () => {
      fs.rm.mockRejectedValue(new Error('Failed to cleanup'))
      const invalidPath = '/invalid/path/that/does/not/exist'
      // Should not throw even if rm fails
      await expect(
        sut.cleanupTempDirectory(invalidPath)
      ).resolves.toBeUndefined()
      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.warn).toHaveBeenCalledWith(
        {
          tempDir: invalidPath,
          error: new Error('Failed to cleanup')
        },
        'FileUpload:ShapefileParser: ERROR: Failed to clean up temporary directory'
      )
    })
  })
})
