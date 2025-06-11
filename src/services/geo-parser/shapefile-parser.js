import GeoParser from './geo-parser.js'
import * as shapefile from 'shapefile'
import { glob } from 'glob'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import AdmZip from 'adm-zip'

const DEFAULT_OPTIONS = {
  maxFiles: 10000,
  maxSize: 1000000000, // 1 GB
  thresholdRatio: 10
}

/**
 * Shapefile parser service for .zip files containing shapefiles
 */
class ShapefileParser extends GeoParser {
  constructor(options = {}) {
    super()
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Get the safe options for zip extraction
   * @returns {Object} The current safety options
   */
  getSafeOptions() {
    return { ...this.options }
  }

  /**
   * Extract a zip file to a temporary directory
   * @param {string} zipPath - Path to the zip file
   * @returns {Promise<string>} Path to the temporary directory containing extracted files
   */
  async extractZip(zipPath) {
    let fileCount = 0
    let totalSize = 0
    const tempDir = await mkdtemp(join(tmpdir(), 'shapefile-'))
    const zip = new AdmZip(zipPath)
    const zipEntries = zip.getEntries()
    zipEntries.forEach((zipEntry) => {
      fileCount++
      if (fileCount > this.options.maxFiles) {
        throw new Error('Reached max number of files')
      }

      const entrySize = zipEntry.getData().length
      totalSize += entrySize
      if (totalSize > this.options.maxSize) {
        throw new Error('Reached max size')
      }

      const compressionRatio = entrySize / zipEntry.header.compressedSize
      if (compressionRatio > this.options.thresholdRatio) {
        throw new Error('Reached max compression ratio')
      }

      if (!zipEntry.isDirectory) {
        zip.extractEntryTo(zipEntry.entryName, tempDir)
      }
    })
    return tempDir
  }

  /**
   * Find all .shp files in a directory
   * @param {string} directory - Directory to search in
   * @returns {Promise<string[]>} Array of paths to .shp files
   */
  async findShapefiles(directory) {
    const shapefiles = await glob('**/*.shp', {
      cwd: directory,
      absolute: true
    })
    return shapefiles
  }

  /**
   * Parse a shapefile and return GeoJSON
   * @param {string} shpPath - Path to the .shp file
   * @returns {Promise<Object>} The parsed GeoJSON object
   */
  async parseShapefile(shpPath) {
    const geoJson = await shapefile.read(shpPath)
    return geoJson
  }

  /**
   * Parse a zip file containing shapefiles and return GeoJSON
   * @param {string} filename - Path to the zip file
   * @returns {Promise<Object>} The parsed GeoJSON object containing all features from all shapefiles
   */
  async parse(filename) {
    try {
      // Extract zip file
      const extractDir = await this.extractZip(filename)

      try {
        // Find all shapefiles
        const shapefiles = await this.findShapefiles(extractDir)

        if (shapefiles.length === 0) {
          throw new Error('No shapefiles found in zip archive')
        }

        // Parse each shapefile and combine features
        const allFeatures = []
        for (const shpPath of shapefiles) {
          const geoJson = await this.parseShapefile(shpPath)
          allFeatures.push(...geoJson.features)
        }

        return {
          type: 'FeatureCollection',
          features: allFeatures
        }
      } finally {
        // Clean up extracted files
        await rm(extractDir, { recursive: true, force: true })
      }
    } catch (error) {
      throw new Error(`Failed to parse shapefile: ${error.message}`)
    }
  }
}

export default ShapefileParser
