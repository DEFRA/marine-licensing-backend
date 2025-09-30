import * as shapefile from 'shapefile'
import { mkdtemp, rm, glob, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { createLogger } from '../../common/helpers/logging/logger.js'
import * as path from 'node:path'
import proj4 from 'proj4'

const logger = createLogger()

const DEFAULT_OPTIONS = {
  maxFiles: 10_000,
  maxSize: 1_000_000_000, // 1 GB in bytes
  thresholdRatio: 10
}

/**
 * Shapefile parser service for zipped shapefiles
 * Converts any CRS system understood by the `proj4` package to WGS84. If there
 * isn't a prj file then it the CRS is unknown and the coordinates will be
 * returned as-is.
 *
 * Edge case: multiple .prj files: the first will be used.
 * Z coordinate elevation handling: ignored as out of scope.
 *
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
   * Transform coordinates from an unknown CRS to WGS84 using a proj4 transform function
   * *NB* Mutates input coordinates!
   * @param {Array} coords - a pair of coordinates in [long, lat] format
   * @param transformer - a proj4 transformer
   */
  transformCoordinates (coords, transformer) {
    if (typeof coords[0] === 'number') {
      // Single coordinate pair
      const [x, y] = transformer.forward(coords)
      coords[0] = x
      coords[1] = y
    } else {
      // Nested array
      coords.forEach(c => this.transformCoordinates(c, transformer))
    }
  }

  /**
   * Parse a shapefile and return GeoJSON
   * @param {string} shpPath - Path to the .shp file
   * @param {function} transformer - a proj4 CRS transformer to convert to WSG84. Null can also mean no conversion needed.
   * @returns {Promise<Object>} The parsed GeoJSON object
   */
  async parseShapefile(shpPath, transformer = null) {
    const source = await shapefile.open(shpPath)
    const features = []

    let result
    while (!(result = await source.read()).done) {
      const feature = result.value

      // Transform coordinates recursively
      if (transformer !== null) {
        this.transformCoordinates(feature.geometry.coordinates, transformer)
      }
      features.push(feature)
    }

    return {
      type: 'FeatureCollection',
      features
    }
  }

  /**
   * Find the *.prj file and return a path to it, if it exists, or null if it doesn't
   * @param {string} directory where the Shapefile zip was extracted
   * @returns {Promise<string|null>}
   */
  async findProjectionFile(directory) {
    logger.debug({ directory }, 'Searching for projection file in directory')
    try {
      const files = await Array.fromAsync(
        glob('**/*.[pP][rR][jJ]', {
          cwd: directory
        })
      )
      const paths = files.map((file) => path.join(directory, file))
      if (paths.length === 0) {
        return null
      } else {
        return paths[0]
      }
    } catch (error) {
      logger.error(
        { directory, error: error.message },
        'Error during glob search for prj file'
      )
      return null
    }
  }

  /**
   * Return the content of the *.prj file or '' if it doesn't exist
   * @param directory - the dir with individual *.shp and *.prj files
   * @returns {Promise<string>}
   */
  async readProjectionFile(directory) {
    const projFilePath = await this.findProjectionFile(directory)

    let projText = ''
    if (projFilePath !== null) {
      // Read the .prj file to get the source CRS (Coordinate Reference System)
      projText = await readFile(projFilePath, 'utf-8')
    }
    return projText
  }

  /**
   * Create a Proj4 CRS transformer
   * @param {string} projText - the content of the shapefile *.prj file or an empty string
   * @returns {function|null}
   */
  createTransformer (projText) {
    // Define target CRS (WGS84)
    const targetCRS = 'EPSG:4326'

    let transformer = null

    if (!(projText.includes('GCS_WGS_1984') || projText.includes('GEOGCS["WGS 84"'))) {
      // The source is not in WGS84 format - the coordinates will need converting to WGS84
      try {
        transformer = proj4(projText, targetCRS)
      } catch (error) {
        logger.error('shapefile-parser: createTransformer(): failed to create the transformer: ' + error.message)
      }

    }
    return transformer
  }

  /**
   * Parse a zip file containing shapefiles and return GeoJSON
   * @param {string} filename - Path to the zip file
   * @returns {Promise<Object>} The parsed GeoJSON object containing all features from all shapefiles
   */
  async parseFile(filename) {
    try {
      const extractDir = await this.extractZip(filename)
      logger.debug({ extractDir }, 'Extracting zip')

      try {
        const shapefiles = await this.findShapefiles(extractDir)
        const projText = await this.readProjectionFile(extractDir)
        const transformer = this.createTransformer(projText)
        logger.debug({ projText }, 'Proj file content')
        logger.debug({ transformer }, 'Transformer created')

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
          const geoJson = await this.parseShapefile(shpPath, transformer)
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
