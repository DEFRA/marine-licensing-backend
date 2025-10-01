import * as shapefile from 'shapefile'
import { glob, mkdtemp, readFile, rm, stat } from 'fs/promises'
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

const MAX_PROJECTION_FILE_SIZE = 10000

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
    if (!coords || !Array.isArray(coords)) {
      return
    }
    if (coords.length === 0) {
      return
    }
    if (typeof coords[0] === 'number') {
      if (coords.length < 2) {
        logger.warn({ coords }, 'Invalid coordinate pair: insufficient elements')
        return
      }
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
   * @param {function} transformer - a proj4 CRS transformer to convert to WSG84. null means no transformation will be applied
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

    if (projFilePath === null) {
      return ''
    }

    const stats = await stat(projFilePath)
    if (stats.size > MAX_PROJECTION_FILE_SIZE) {
      logger.warn(
        { size: stats.size },
        'Projection file exceeds safe size limit'
      )
      return ''
    }

    return readFile(projFilePath, 'utf-8')
  }

  /**
   * Check if a CRS is WGS84 by comparing with proj4
   * @param {string} crsWkt - WKT string of the CRS
   * @returns {boolean} true if the CRS is equivalent to WGS84
   */
  isWGS84(crsWkt) {
    if (!crsWkt || crsWkt.trim() === '') {
      return false
    }

    try {
      const wgs84 = proj4('EPSG:4326')
      const sourceCrs = proj4(crsWkt)

      // Compare the proj4 definitions
      // Both should have longlat projection and WGS84 datum
      const wgs84Def = wgs84.oProj
      const sourceDef = sourceCrs.oProj

      return (
        sourceDef.projName === wgs84Def.projName &&
        (sourceDef.datumCode === wgs84Def.datumCode ||
         sourceDef.datum === wgs84Def.datum ||
         (sourceDef.datumCode === 'WGS84' || sourceDef.datum === 'WGS84'))
      )
    } catch (error) {
      logger.debug({ error: error.message }, 'Error checking if CRS is WGS84')
      return false
    }
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

    if (!this.isWGS84(projText)) {
      // The source is not in WGS84 format - the coordinates will need converting to WGS84
      transformer = proj4(projText, targetCRS) // can throw
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
