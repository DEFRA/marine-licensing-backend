import { expect, jest } from '@jest/globals'
import { join } from 'node:path'
import * as fs from 'node:fs/promises'
import AdmZip from 'adm-zip'
import proj4 from 'proj4'
import * as shapefile from 'shapefile'

import {
  ShapefileParser,
  MAX_PROJECTION_FILE_SIZE_BYTES
} from './shapefile-parser.js'
import { createLogger } from '../../common/helpers/logging/logger.js'

jest.mock('node:fs/promises')
jest.mock('../../common/helpers/logging/logger.js', () => {
  const logger = {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
  return {
    createLogger: jest.fn(() => logger)
  }
})

jest.mock('adm-zip')
jest.mock('shapefile')

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
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const parser = new ShapefileParser()

      expect(parser.options).toEqual({
        maxFiles: 10_000,
        maxSize: 1_000_000_000,
        thresholdRatio: 100
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
        thresholdRatio: 100
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

    beforeEach(() => {
      mockAdmZip = {
        getEntries: jest.fn().mockReturnValue(mockZipEntries),
        extractEntryTo: jest.fn()
      }
      AdmZip.mockImplementation(() => mockAdmZip)
      fs.mkdtemp.mockResolvedValue('/tmp/mock-dir-123')
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
          header: { compressedSize: 909 } // 110 compression ration > 100
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
      const result = await sut.extractZip(zipPath)
      expect(result).toBe('/tmp/mock-dir-123')
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
      await sut.extractZip(zipPath)
      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledTimes(2)
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
      const mockRead = jest
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
      jest.spyOn(sut, 'transformCoordinates').mockResolvedValue(pointFeature)
      const result = await sut.parseShapefile(shpPath, mockRealTransformer)
      expect(sut.transformCoordinates).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockGeoJSON)
    })

    it('should parse multiple features in the shapefile', async () => {
      const multipleMockRead = jest
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
      jest
        .spyOn(sut, 'findProjectionFile')
        .mockResolvedValue(`${directory}/project1.prj`)
    })

    it('calls findProjectionFile to find the path to the projection file', async () => {
      const result = await sut.readProjectionFile(
        '/tmp/mock-dir-789/project.prj'
      )
      expect(result).toEqual(mockPrjFileContent)
    })

    it('returns null when the proj file is not found in the given directory', async () => {
      jest.spyOn(sut, 'findProjectionFile').mockResolvedValue(null)
      const result = await sut.readProjectionFile(directory)
      expect(result).toBeNull()
    })

    it('returns null if the content of the proj file is is too large to read', async () => {
      fs.stat.mockResolvedValue({
        size: MAX_PROJECTION_FILE_SIZE_BYTES + 1
      })
      const result = await sut.readProjectionFile(directory)
      expect(result).toBeNull()
    })

    it('reads the proj file if it is exactly at the max size', async () => {
      fs.stat.mockResolvedValue({
        size: MAX_PROJECTION_FILE_SIZE_BYTES
      })
      const result = await sut.readProjectionFile(directory)
      expect(result).toBe(mockPrjFileContent)
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
      jest.spyOn(sut, 'extractZip').mockResolvedValue(mockTmpDir)
      jest.spyOn(sut, 'findShapefiles').mockResolvedValue([mockShapefileA])
      jest.spyOn(sut, 'readProjectionFile').mockResolvedValue(wsg84Projection)
      jest.spyOn(sut, 'createTransformer').mockReturnValue(null)
      jest.spyOn(sut, 'parseShapefile').mockResolvedValue({
        type: 'FeatureCollection',
        features: [pointFeature]
      })
      jest.spyOn(sut, 'cleanupTempDirectory').mockResolvedValue()
    })

    it('should decompress the zip file', async () => {
      await sut.parseFile(filename)
      expect(sut.extractZip).toHaveBeenCalledTimes(1)
    })

    it('it assembles all features into a feature collection', async () => {
      jest.spyOn(sut, 'parseShapefile').mockResolvedValue({
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
      jest
        .spyOn(sut, 'findShapefiles')
        .mockResolvedValue([mockShapefileA, mockShapefileB])
      await sut.parseFile(filename)
      expect(sut.parseShapefile).toHaveBeenCalledTimes(2)
    })

    it('throws an error if no shapefile was found', async () => {
      jest.spyOn(sut, 'findShapefiles').mockResolvedValue([])
      await expect(sut.parseFile(filename)).rejects.toThrow(
        'Failed to parse shapefile: No shapefiles found in zip archive'
      )
    })

    it('it cleans up the zip extract directory', async () => {
      await sut.parseFile(filename)
      await new Promise((resolve) => setImmediate(resolve))
      expect(sut.cleanupTempDirectory).toHaveBeenCalledTimes(1)
      expect(sut.cleanupTempDirectory).toHaveBeenCalledWith(mockTmpDir)
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
      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalledWith(
        {
          tempDir: invalidPath,
          error: 'Failed to cleanup'
        },
        'Failed to clean up temporary directory'
      )
    })
  })
})
