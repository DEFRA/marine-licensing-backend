import * as shapefile from 'shapefile'
import { mkdtemp, rm, glob } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { createLogger } from '../../common/helpers/logging/logger.js'
import * as path from 'node:path'

const logger = createLogger()

const DEFAULT_OPTIONS = {
  maxFiles: 10000,
  maxSize: 1000000000, // 1 GB
  thresholdRatio: 10
}

/**
 * Shapefile parser service for zipped shapefiles
 */
export class ShapefileParser {
  constructor(options = {}) {
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
   * Safely extract a zip file to a temporary directory
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
    logger.debug({ directory }, 'Searching for shapefiles in directory')

    try {
      const files = await Array.fromAsync(
        glob('**/*.[sS][hH][pP]', {
          cwd: directory
        })
      )
      return files.map((file) => path.join(directory, file))
    } catch (error) {
      logger.error(
        { directory, error: error.message },
        'Error during glob search'
      )
      return []
    }
  }

  /**
   * Parse a shapefile and return GeoJSON
   * @param {string} shpPath - Path to the .shp file
   * @returns {Promise<Object>} The parsed GeoJSON object
   */
  async parseShapefile(shpPath) {
    return shapefile.read(shpPath)
  }

  /**
   * Parse a zip file containing shapefiles and return GeoJSON
   * @param {string} filename - Path to the zip file
   * @returns {Promise<Object>} The parsed GeoJSON object containing all features from all shapefiles
   */
  async parseFile(filename) {
    try {
      // Extract zip file
      const extractDir = await this.extractZip(filename)
      logger.debug({ extractDir }, 'Extracting zip')

      try {
        // Find all shapefiles
        const shapefiles = await this.findShapefiles(extractDir)

        logger.debug(
          {
            shapefiles,
            type: typeof shapefiles,
            isArray: Array.isArray(shapefiles),
            length: shapefiles?.length
          },
          'Shapefiles found before iteration'
        )

        if (shapefiles.length === 0) {
          throw new Error('No shapefiles found in zip archive')
        }

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
        setImmediate(() => {
          this.cleanupTempDirectory(extractDir)
        })
      }
    } catch (error) {
      throw new Error(`Failed to parse shapefile: ${error.message}`)
    }
  }

  async cleanupTempDirectory(tempDir) {
    try {
      await rm(tempDir, { recursive: true, force: true })
      logger.debug({ tempDir }, 'Cleaned up temp directory')
    } catch (error) {
      logger.error(
        {
          tempDir,
          error: error.message
        },
        'Failed to clean up temporary directory'
      )
    }
  }
}

export const shapefileParser = new ShapefileParser()
