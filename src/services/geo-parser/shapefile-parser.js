import * as shapefile from 'shapefile'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { createLogger } from '../../common/helpers/logging/logger.js'
import proj4 from 'proj4'
import * as path from 'node:path'

const logger = createLogger()

const DEFAULT_OPTIONS = {
  maxFiles: 10_000,
  maxSize: 1_000_000_000, // 1 GB in bytes
  thresholdRatio: 10
}

export const MAX_PROJECTION_FILE_SIZE_BYTES = 50_000

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
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'shapefile-'))
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
        fs.glob('**/*.[sS][hH][pP]', {
          cwd: directory
        })
      )
      return files.map((file) => join(directory, file))
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
   * *NB* Mutates input coordinates for efficiency when reading large Shapefiles
   * @param {Array} coords - a pair of coordinates in [long, lat] format
   * @param transformer - a proj4 transformer
   */
  transformCoordinates(coords, transformer) {
    if (!coords || !Array.isArray(coords)) {
      return
    }
    if (coords.length === 0) {
      return
    }
    if (typeof coords[0] === 'number') {
      if (coords.length < 2) {
        logger.warn(
          { coords },
          'Invalid coordinate pair: insufficient elements'
        )
        return
      }
      // Single coordinate pair
      const [x, y] = transformer.forward(coords)
      // proj4 can return Infinity or NaN for invalid transformations
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        logger.error(
          { original: coords, transformed: [x, y] },
          'Invalid transformation result - no transformation has taken place'
        )
        return
      }
      coords[0] = x
      coords[1] = y
    } else {
      // Nested array
      for (const c of coords) {
        this.transformCoordinates(c, transformer)
      }
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

    let result = await source.read()
    while (!result.done) {
      const feature = result.value

      // Transform coordinates recursively
      if (transformer !== null) {
        this.transformCoordinates(feature.geometry.coordinates, transformer)
      }
      features.push(feature)

      result = await source.read()
    }

    return {
      type: 'FeatureCollection',
      features
    }
  }

  /**
   * Find the *.prj file and return a path to it, if it exists, or null if it doesn't.
   *
   * There is a *very* *strong* convention that the projection file has the same basename as the
   * *.shp file.  Most software packages apparently treat it as a requirement.  This is required
   * for interoperability and is strongly implied by the Shapefile spec.
   *
   * @param {string} directory where the Shapefile zip was extracted
   * @param {string} basename - the basename of the *.shp file.  A shp file called 'project-a.shp' will have a basename of 'project-a'.
   * @returns {Promise<string|null>}
   */
  async findProjectionFile(directory, basename) {
    logger.debug(
      { directory },
      `Searching for projection file in directory with basename ${basename}`
    )
    if (!basename) {
      return null
    }
    try {
      const files = await Array.fromAsync(
        fs.glob(`**/${basename}.[pP][rR][jJ]`, {
          cwd: directory
        })
      )
      const paths = files.map((file) => join(directory, file))
      if (paths.length > 1) {
        logger.warn({ paths }, 'Multiple projection files found, using first')
      }
      if (paths[0]) {
        logger.debug({ paths }, 'Found projection file')
        return paths[0]
      } else {
        logger.error(
          { paths },
          'No projection file found - coordinates will not be transformed'
        )
        // JMS: consider if we want to throw and reject the upload with a user message
        return null
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
   * Return the content of the *.prj file or null if it doesn't exist
   * @param directory - the dir with individual *.shp and *.prj files
   * @param basename - the basename of the .shp file
   * @returns {Promise<string|null>}
   */
  async readProjectionFile(directory, basename) {
    const projFilePath = await this.findProjectionFile(directory, basename)

    if (!projFilePath) {
      logger.error()
      return null
    }

    const stats = await fs.stat(projFilePath)
    if (stats.size > MAX_PROJECTION_FILE_SIZE_BYTES) {
      logger.error(
        { size: stats.size },
        `Projection file size ${stats.size} exceeds safe size limit ${MAX_PROJECTION_FILE_SIZE_BYTES} : no transformation will take place`
      )
      // JMS: consider whether we want to throw instead - and reject the upload
      return null
    }

    return fs.readFile(projFilePath, 'utf-8')
  }

  /**
   * Create a Proj4 CRS transformer
   * @param {string|null} projText - the content of the shapefile *.prj file or null if it was missing
   * @returns {Object}
   */
  createTransformer(projText) {
    if (projText === null) {
      return null
    }
    const targetCRS = 'EPSG:4326'
    try {
      return proj4(projText, targetCRS)
    } catch (error) {
      logger.error(
        { error: error.message, projText },
        'Failed to create proj4 transformer'
      )
      return null
    }
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

        logger.debug(
          {
            shapefiles,
            type: typeof shapefiles
          },
          'Shapefiles found before iteration'
        )

        if (shapefiles.length === 0) {
          throw new Error('No shapefiles found in zip archive')
        }

        const allFeatures = []
        for (const shpPath of shapefiles) {
          const basename = path.basename(shpPath, path.extname(shpPath))
          const projText = await this.readProjectionFile(extractDir, basename)
          const transformer = this.createTransformer(projText)
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
      await fs.rm(tempDir, { recursive: true, force: true })
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
