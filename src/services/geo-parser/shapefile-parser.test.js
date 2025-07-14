import { ShapefileParser } from './shapefile-parser.js'
import * as shapefile from 'shapefile'
import { mkdtemp, rm, glob } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import AdmZip from 'adm-zip'
import * as path from 'node:path'

// Mock dependencies
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

// Mock logger
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

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock os.tmpdir
    tmpdir.mockReturnValue('/tmp')

    // Mock path.join
    join.mockImplementation((dir, file) => {
      if (file === 'shapefile-') return '/tmp/shapefile-'
      return `${dir}/${file}`
    })
    path.join.mockImplementation((dir, file) => `${dir}/${file}`)

    // Mock mkdtemp
    mkdtemp.mockResolvedValue('/tmp/shapefile-test')

    // Mock rm
    rm.mockResolvedValue()

    // Mock AdmZip
    mockZipEntries = []
    mockAdmZip = {
      getEntries: jest.fn(() => mockZipEntries),
      extractEntryTo: jest.fn()
    }
    AdmZip.mockImplementation(() => mockAdmZip)

    // Mock glob
    glob.mockResolvedValue([])

    shapefileParser = new ShapefileParser()
  })

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      // Given - new ShapefileParser instance
      const parser = new ShapefileParser()

      // Then - should set default values
      expect(parser.options).toEqual({
        maxFiles: 10000,
        maxSize: 1000000000,
        thresholdRatio: 10
      })
    })

    it('should initialize with custom options', () => {
      // Given - custom options
      const customOptions = {
        maxFiles: 5000,
        maxSize: 500000000,
        thresholdRatio: 5
      }

      // When - creating parser with custom options
      const parser = new ShapefileParser(customOptions)

      // Then - should use custom options
      expect(parser.options).toEqual(customOptions)
    })

    it('should merge custom options with defaults', () => {
      // Given - partial custom options
      const customOptions = {
        maxFiles: 5000
      }

      // When - creating parser with partial options
      const parser = new ShapefileParser(customOptions)

      // Then - should merge with defaults
      expect(parser.options).toEqual({
        maxFiles: 5000,
        maxSize: 1000000000,
        thresholdRatio: 10
      })
    })
  })

  describe('getSafeOptions', () => {
    it('should return current safety options', () => {
      // Given - parser with default options
      const parser = new ShapefileParser()

      // When - getting safe options
      const options = parser.getSafeOptions()

      // Then - should return copy of options
      expect(options).toEqual(parser.options)
      expect(options).not.toBe(parser.options) // Should be a copy
    })

    it('should return custom options', () => {
      // Given - parser with custom options
      const customOptions = {
        maxFiles: 5000,
        maxSize: 500000000,
        thresholdRatio: 5
      }
      const parser = new ShapefileParser(customOptions)

      // When - getting safe options
      const options = parser.getSafeOptions()

      // Then - should return custom options
      expect(options).toEqual(customOptions)
    })
  })

  describe('extractZip', () => {
    const zipPath = '/tmp/test.zip'

    beforeEach(() => {
      // Mock zip entries
      mockZipEntries = [
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
      mockAdmZip.getEntries.mockReturnValue(mockZipEntries)
    })

    it('should successfully extract zip file', async () => {
      // Given - valid zip file

      // When - extracting zip
      const result = await shapefileParser.extractZip(zipPath)

      // Then - should extract successfully
      expect(result).toBe('/tmp/shapefile-test')
      expect(mkdtemp).toHaveBeenCalledWith('/tmp/shapefile-')
      expect(AdmZip).toHaveBeenCalledWith(zipPath)
      expect(mockAdmZip.getEntries).toHaveBeenCalled()
      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledTimes(3)
    })

    it('should skip directory entries', async () => {
      // Given - zip with directory entry
      mockZipEntries.push({
        entryName: 'folder/',
        isDirectory: true,
        getData: () => Buffer.alloc(0),
        header: { compressedSize: 0 }
      })

      // When - extracting zip
      await shapefileParser.extractZip(zipPath)

      // Then - should skip directory entry
      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledTimes(3) // Still only 3 files
    })

    it('should throw error when exceeding max files limit', async () => {
      // Given - too many files
      const manyEntries = Array(10001).fill({
        entryName: 'test.shp',
        isDirectory: false,
        getData: () => Buffer.alloc(100),
        header: { compressedSize: 50 }
      })
      mockAdmZip.getEntries.mockReturnValue(manyEntries)

      // When/Then - should throw error
      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Reached max number of files'
      )
    })

    it('should throw error when exceeding max size limit', async () => {
      // Given - files exceeding size limit
      const largeEntries = [
        {
          entryName: 'large.shp',
          isDirectory: false,
          getData: () => Buffer.alloc(2000000000), // 2GB
          header: { compressedSize: 1000000000 }
        }
      ]
      mockAdmZip.getEntries.mockReturnValue(largeEntries)

      // When/Then - should throw error
      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Reached max size'
      )
    })

    it('should throw error when exceeding compression ratio limit', async () => {
      // Given - high compression ratio (potential zip bomb)
      const suspiciousEntries = [
        {
          entryName: 'suspicious.shp',
          isDirectory: false,
          getData: () => Buffer.alloc(1000),
          header: { compressedSize: 50 } // 20:1 ratio > 10:1 threshold
        }
      ]
      mockAdmZip.getEntries.mockReturnValue(suspiciousEntries)

      // When/Then - should throw error
      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Reached max compression ratio'
      )
    })

    it('should handle AdmZip errors', async () => {
      // Given - AdmZip throws error
      AdmZip.mockImplementation(() => {
        throw new Error('Invalid zip file')
      })

      // When/Then - should throw error
      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Invalid zip file'
      )
    })

    it('should handle mkdtemp errors', async () => {
      // Given - mkdtemp fails
      mkdtemp.mockRejectedValue(new Error('Permission denied'))

      // When/Then - should throw error
      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Permission denied'
      )
    })

    it('should handle extraction errors', async () => {
      // Given - extraction fails
      mockAdmZip.extractEntryTo.mockImplementation(() => {
        throw new Error('Extraction failed')
      })

      // When/Then - should throw error
      await expect(shapefileParser.extractZip(zipPath)).rejects.toThrow(
        'Extraction failed'
      )
    })

    it('should handle empty zip file', async () => {
      // Given - empty zip file
      mockAdmZip.getEntries.mockReturnValue([])

      // When - extracting empty zip
      const result = await shapefileParser.extractZip(zipPath)

      // Then - should succeed with empty directory
      expect(result).toBe('/tmp/shapefile-test')
      expect(mockAdmZip.extractEntryTo).not.toHaveBeenCalled()
    })

    it('should handle zip with different file extensions', async () => {
      // Given - zip with various extensions
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

      // When - extracting zip
      await shapefileParser.extractZip(zipPath)

      // Then - should extract all files
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
      // Given - directory with shapefiles
      const mockFiles = ['test.shp', 'subfolder/another.shp']
      Array.fromAsync.mockResolvedValue(mockFiles)
      path.join.mockImplementation((dir, file) => `${dir}/${file}`)

      // When - finding shapefiles
      const result = await shapefileParser.findShapefiles(directory)

      // Then - should return full paths
      expect(result).toEqual([
        '/tmp/shapefile-test/test.shp',
        '/tmp/shapefile-test/subfolder/another.shp'
      ])
      expect(glob).toHaveBeenCalledWith('**/*.[sS][hH][pP]', { cwd: directory })
      expect(Array.fromAsync).toHaveBeenCalledTimes(1)
    })

    it('should handle case-insensitive search', async () => {
      // Given - files with different case
      const mockFiles = ['TEST.SHP', 'lower.shp', 'Mixed.Shp']
      Array.fromAsync.mockResolvedValue(mockFiles)
      path.join.mockImplementation((dir, file) => `${dir}/${file}`)

      // When - finding shapefiles
      const result = await shapefileParser.findShapefiles(directory)

      // Then - should find all variations
      expect(result).toHaveLength(3)
      expect(result).toEqual([
        '/tmp/shapefile-test/TEST.SHP',
        '/tmp/shapefile-test/lower.shp',
        '/tmp/shapefile-test/Mixed.Shp'
      ])
    })

    it('should return empty array when no shapefiles found', async () => {
      // Given - directory with no shapefiles
      Array.fromAsync.mockResolvedValue([])

      // When - finding shapefiles
      const result = await shapefileParser.findShapefiles(directory)

      // Then - should return empty array
      expect(result).toEqual([])
    })

    it('should handle glob errors', async () => {
      // Given - glob throws error
      Array.fromAsync.mockRejectedValue(new Error('Glob error'))

      // When - finding shapefiles
      const result = await shapefileParser.findShapefiles(directory)

      // Then - should return empty array
      expect(result).toEqual([])
    })

    it('should handle nested directories', async () => {
      // Given - nested directory structure
      const mockFiles = [
        'level1/level2/test.shp',
        'level1/another.shp',
        'root.shp'
      ]
      Array.fromAsync.mockResolvedValue(mockFiles)
      path.join.mockImplementation((dir, file) => `${dir}/${file}`)

      // When - finding shapefiles
      const result = await shapefileParser.findShapefiles(directory)

      // Then - should find all nested files
      expect(result).toHaveLength(3)
      expect(result).toContain('/tmp/shapefile-test/level1/level2/test.shp')
    })

    it('should handle directory with special characters', async () => {
      // Given - directory with special characters
      const specialDir = '/tmp/test-dir with spaces'
      const mockFiles = ['test.shp']
      Array.fromAsync.mockResolvedValue(mockFiles)
      path.join.mockImplementation((dir, file) => `${dir}/${file}`)

      // When - finding shapefiles
      const result = await shapefileParser.findShapefiles(specialDir)

      // Then - should handle special characters
      expect(result).toEqual(['/tmp/test-dir with spaces/test.shp'])
    })
  })

  describe('parseShapefile', () => {
    const shpPath = '/tmp/test.shp'
    const mockGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-0.1, 51.5]
          },
          properties: {
            name: 'Test Point'
          }
        }
      ]
    }

    beforeEach(() => {
      shapefile.read.mockResolvedValue(mockGeoJSON)
    })

    it('should successfully parse shapefile', async () => {
      // Given - valid shapefile

      // When - parsing shapefile
      const result = await shapefileParser.parseShapefile(shpPath)

      // Then - should return GeoJSON
      expect(result).toEqual(mockGeoJSON)
      expect(shapefile.read).toHaveBeenCalledWith(shpPath)
    })

    it('should handle shapefile parsing errors', async () => {
      // Given - shapefile parsing fails
      const error = new Error('Invalid shapefile')
      shapefile.read.mockRejectedValue(error)

      // When/Then - should throw error
      await expect(shapefileParser.parseShapefile(shpPath)).rejects.toThrow(
        'Invalid shapefile'
      )
    })

    it('should handle empty shapefile', async () => {
      // Given - empty shapefile
      const emptyGeoJSON = {
        type: 'FeatureCollection',
        features: []
      }
      shapefile.read.mockResolvedValue(emptyGeoJSON)

      // When - parsing empty shapefile
      const result = await shapefileParser.parseShapefile(shpPath)

      // Then - should return empty GeoJSON
      expect(result).toEqual(emptyGeoJSON)
    })

    it('should handle large shapefile', async () => {
      // Given - large shapefile
      const largeGeoJSON = {
        type: 'FeatureCollection',
        features: Array(1000).fill({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-0.1, 51.5]
          },
          properties: {
            name: 'Point'
          }
        })
      }
      shapefile.read.mockResolvedValue(largeGeoJSON)

      // When - parsing large shapefile
      const result = await shapefileParser.parseShapefile(shpPath)

      // Then - should handle large file
      expect(result).toEqual(largeGeoJSON)
      expect(result.features).toHaveLength(1000)
    })

    it('should handle different geometry types', async () => {
      // Given - shapefile with different geometries
      const mixedGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-0.1, 51.5]
            },
            properties: {}
          },
          {
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
        ]
      }
      shapefile.read.mockResolvedValue(mixedGeoJSON)

      // When - parsing mixed shapefile
      const result = await shapefileParser.parseShapefile(shpPath)

      // Then - should handle mixed geometries
      expect(result).toEqual(mixedGeoJSON)
      expect(result.features[0].geometry.type).toBe('Point')
      expect(result.features[1].geometry.type).toBe('Polygon')
    })
  })

  describe('parseFile', () => {
    const filename = '/tmp/test.zip'
    const mockGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-0.1, 51.5]
          },
          properties: {}
        }
      ]
    }

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
      // Given - zip with single shapefile

      // When - parsing file
      const result = await shapefileParser.parseFile(filename)

      // Then - should return combined GeoJSON
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
      // Given - zip with multiple shapefiles
      const shapefilePaths = [
        '/tmp/extract-dir/test1.shp',
        '/tmp/extract-dir/test2.shp'
      ]
      const geoJSON1 = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-0.1, 51.5] },
            properties: { name: 'Point 1' }
          }
        ]
      }
      const geoJSON2 = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-0.2, 51.6] },
            properties: { name: 'Point 2' }
          }
        ]
      }

      shapefileParser.findShapefiles.mockResolvedValue(shapefilePaths)
      shapefileParser.parseShapefile
        .mockResolvedValueOnce(geoJSON1)
        .mockResolvedValueOnce(geoJSON2)

      // When - parsing file
      const result = await shapefileParser.parseFile(filename)

      // Then - should combine all features
      expect(result).toEqual({
        type: 'FeatureCollection',
        features: [...geoJSON1.features, ...geoJSON2.features]
      })
      expect(shapefileParser.parseShapefile).toHaveBeenCalledTimes(2)
    })

    it('should throw error when no shapefiles found', async () => {
      // Given - zip with no shapefiles
      shapefileParser.findShapefiles.mockResolvedValue([])

      // When/Then - should throw error
      await expect(shapefileParser.parseFile(filename)).rejects.toThrow(
        'No shapefiles found in zip archive'
      )
    })

    it('should handle extraction errors', async () => {
      // Given - extraction fails
      shapefileParser.extractZip.mockRejectedValue(
        new Error('Extraction failed')
      )

      // When/Then - should throw error with context
      await expect(shapefileParser.parseFile(filename)).rejects.toThrow(
        'Failed to parse shapefile: Extraction failed'
      )
    })

    it('should handle shapefile parsing errors', async () => {
      // Given - shapefile parsing fails
      shapefileParser.parseShapefile.mockRejectedValue(
        new Error('Parse failed')
      )

      // When/Then - should throw error with context
      await expect(shapefileParser.parseFile(filename)).rejects.toThrow(
        'Failed to parse shapefile: Parse failed'
      )
    })

    it('should cleanup temp directory even on error', async () => {
      // Given - parsing fails after extraction
      shapefileParser.parseShapefile.mockRejectedValue(
        new Error('Parse failed')
      )

      // When - parsing file
      await expect(shapefileParser.parseFile(filename)).rejects.toThrow()

      // Then - should still cleanup
      expect(shapefileParser.cleanupTempDirectory).toHaveBeenCalledWith(
        '/tmp/extract-dir'
      )
    })

    it('should handle empty shapefiles', async () => {
      // Given - empty shapefiles
      const emptyGeoJSON = {
        type: 'FeatureCollection',
        features: []
      }
      shapefileParser.parseShapefile.mockResolvedValue(emptyGeoJSON)

      // When - parsing file
      const result = await shapefileParser.parseFile(filename)

      // Then - should return empty feature collection
      expect(result).toEqual({
        type: 'FeatureCollection',
        features: []
      })
    })

    it('should handle mixed empty and non-empty shapefiles', async () => {
      // Given - mixed shapefiles
      const shapefilePaths = [
        '/tmp/extract-dir/empty.shp',
        '/tmp/extract-dir/nonempty.shp'
      ]
      const emptyGeoJSON = {
        type: 'FeatureCollection',
        features: []
      }
      const nonEmptyGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-0.1, 51.5] },
            properties: {}
          }
        ]
      }

      shapefileParser.findShapefiles.mockResolvedValue(shapefilePaths)
      shapefileParser.parseShapefile
        .mockResolvedValueOnce(emptyGeoJSON)
        .mockResolvedValueOnce(nonEmptyGeoJSON)

      // When - parsing file
      const result = await shapefileParser.parseFile(filename)

      // Then - should include only non-empty features
      expect(result).toEqual(nonEmptyGeoJSON)
    })
  })

  describe('cleanupTempDirectory', () => {
    const tempDir = '/tmp/test-dir'

    it('should successfully cleanup temp directory', async () => {
      // Given - temp directory exists

      // When - cleaning up
      await shapefileParser.cleanupTempDirectory(tempDir)

      // Then - should remove directory
      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should handle cleanup errors gracefully', async () => {
      // Given - cleanup fails
      rm.mockRejectedValue(new Error('Permission denied'))

      // When - cleaning up
      await expect(
        shapefileParser.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      // Then - should not throw error
      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })

    it('should handle non-existent directory', async () => {
      // Given - directory doesn't exist
      const error = new Error('Directory not found')
      error.code = 'ENOENT'
      rm.mockRejectedValue(error)

      // When - cleaning up
      await expect(
        shapefileParser.cleanupTempDirectory(tempDir)
      ).resolves.not.toThrow()

      // Then - should handle gracefully
      expect(rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true })
    })
  })

  describe('Security features', () => {
    it('should prevent zip bomb attacks', async () => {
      // Given - suspicious zip entry (high compression ratio)
      const suspiciousEntries = [
        {
          entryName: 'bomb.shp',
          isDirectory: false,
          getData: () => Buffer.alloc(1000000), // 1MB uncompressed
          header: { compressedSize: 1000 } // 1KB compressed = 1000:1 ratio
        }
      ]
      mockAdmZip.getEntries.mockReturnValue(suspiciousEntries)

      // When/Then - should throw error
      await expect(shapefileParser.extractZip('/tmp/test.zip')).rejects.toThrow(
        'Reached max compression ratio'
      )
    })

    it('should prevent directory traversal attacks', async () => {
      // Given - malicious zip entry with path traversal
      const maliciousEntries = [
        {
          entryName: '../../../etc/passwd',
          isDirectory: false,
          getData: () => Buffer.alloc(100),
          header: { compressedSize: 50 }
        }
      ]
      mockAdmZip.getEntries.mockReturnValue(maliciousEntries)

      // When - extracting malicious zip
      await shapefileParser.extractZip('/tmp/test.zip')

      // Then - should extract to temp directory (not traverse)
      expect(mockAdmZip.extractEntryTo).toHaveBeenCalledWith(
        '../../../etc/passwd',
        '/tmp/shapefile-test'
      )
    })

    it('should limit number of files extracted', async () => {
      // Given - parser with low file limit
      const restrictiveParser = new ShapefileParser({ maxFiles: 2 })
      const manyEntries = Array(3).fill({
        entryName: 'test.shp',
        isDirectory: false,
        getData: () => Buffer.alloc(100),
        header: { compressedSize: 50 }
      })
      mockAdmZip.getEntries.mockReturnValue(manyEntries)

      // When/Then - should throw error
      await expect(
        restrictiveParser.extractZip('/tmp/test.zip')
      ).rejects.toThrow('Reached max number of files')
    })

    it('should limit total extracted size', async () => {
      // Given - parser with low size limit
      const restrictiveParser = new ShapefileParser({ maxSize: 1000 })
      const largeEntries = [
        {
          entryName: 'large.shp',
          isDirectory: false,
          getData: () => Buffer.alloc(2000),
          header: { compressedSize: 1000 }
        }
      ]
      mockAdmZip.getEntries.mockReturnValue(largeEntries)

      // When/Then - should throw error
      await expect(
        restrictiveParser.extractZip('/tmp/test.zip')
      ).rejects.toThrow('Reached max size')
    })
  })
})
