import * as shapefile from 'shapefile'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import AdmZip from 'adm-zip'
import proj4 from 'proj4'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { GEO_PARSER_ERROR_CODES, isGeoParserErrorCode } from './error-codes.js'

const logger = createLogger()

/**
 * DEFAULT_OPTIONS: constants for safe Zip extraction for Shapefiles.
 * The threshold ratio is calculated on a per file basis, so needs to accommodate
 * the most highly compressed file you expect to see.  Shapefiles .dbf files can
 * be *highly* compressible when multiple sites are included at the extremes,
 * hence the large number for `thresholdRatio`.
 *
 * We have seen a file where the .dbf file compressed from 6.2MB to 93KB, a
 * factor of 66.8!
 *
 * @type {{maxFiles: number, maxSize: number, thresholdRatio: number}}
 */
const DEFAULT_OPTIONS = {
  maxFiles: 10_000,
  maxSize: 1_000_000_000, // 1 GB in bytes
  thresholdRatio: 100
}

const LONGITUDE_MIN = -180
const LONGITUDE_MAX = 180
const LATITUDE_MIN = -90
const LATITUDE_MAX = 90

// Test .prj files are about 500 bytes.  This is expected to provide sufficient
// headroom for the most complex .prj files but also keep a reasonable limit
// for processing and memory limits.
export const MAX_PROJECTION_FILE_SIZE_BYTES = 50_000

/**
 * Shapefile file extensions
 * A complete shapefile consists of multiple files with these extensions
 */
const SHAPEFILE_EXTENSIONS = {
  SHAPE: '.shp', // Main geometry file
  INDEX: '.shx', // Shape index file
  DBASE: '.dbf', // Attribute data file
  PROJECTION: '.prj' // Projection/coordinate system definition
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
  logSystem = 'FileUpload:ShapefileParser'

  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Get the safe options for zip extraction
   */
  getSafeOptions() {
    return { ...this.options }
  }

  /**
   * Safely extract a zip file to a temporary directory
   */
  async extractZip(zipPath) {
    this.zipFile = zipPath
    logger.info(`${this.logSystem}: Extracting Zip file from ${zipPath}`)
    let fileCount = 0
    let totalSize = 0
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'shapefile-'))
    const zip = new AdmZip(zipPath)
    const zipEntries = zip.getEntries()
    for (const zipEntry of zipEntries) {
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
    }
    logger.info(
      `${this.logSystem}: Successfully extracted zip file from: ${zipPath}`
    )
    await this.validateShapefileContents(tempDir)
    this.zipFile = null
    return tempDir
  }

  /**
   * Collect file metadata from directory entries
   * @param {Array} files - directory entries from fs.readdir
   * @param {string} tempDir - base directory path
   * @returns {Array} array of file metadata objects
   */
  collectFileMetadata(files, tempDir) {
    const allFiles = []
    for (const file of files) {
      if (file.isFile()) {
        const fullPath = path.join(file.path, file.name)
        allFiles.push({
          name: file.name,
          lowerName: file.name.toLowerCase(),
          fullPath,
          relativePath: path.relative(tempDir, fullPath)
        })
      }
    }
    logger.debug(
      { allFiles },
      `${this.logSystem}: all files found in zip ${this.zipFile}`
    )
    return allFiles
  }

  /**
   * Validate that the extracted shapefile contains all required files
   * Uses fail-fast approach - returns on first validation error
   *
   * @param {string} tempDir - directory where zip was extracted
   * @throws {Error} with error code from GEO_PARSER_ERROR_CODES
   */
  async validateShapefileContents(tempDir) {
    logger.info({ tempDir }, `${this.logSystem}: Validating shapefile contents`)

    const files = await fs.readdir(tempDir, {
      recursive: true,
      withFileTypes: true
    })

    const allFiles = this.collectFileMetadata(files, tempDir)

    const hasShp = allFiles.some((f) =>
      f.lowerName.endsWith(SHAPEFILE_EXTENSIONS.SHAPE)
    )
    const hasShx = allFiles.some((f) =>
      f.lowerName.endsWith(SHAPEFILE_EXTENSIONS.INDEX)
    )
    const hasDbf = allFiles.some((f) =>
      f.lowerName.endsWith(SHAPEFILE_EXTENSIONS.DBASE)
    )

    if (!hasShp || !hasShx || !hasDbf) {
      logger.warn(
        { hasShp, hasShx, hasDbf, tempDir },
        `${this.logSystem}: Validation failed - missing core shapefile files`
      )
      throw new Error(GEO_PARSER_ERROR_CODES.SHAPEFILE_MISSING_CORE_FILES)
    }

    const hasPrj = allFiles.some((f) =>
      f.lowerName.endsWith(SHAPEFILE_EXTENSIONS.PROJECTION)
    )

    if (!hasPrj) {
      logger.warn(
        { tempDir },
        `${this.logSystem}: Validation failed - missing .prj file`
      )
      throw new Error(GEO_PARSER_ERROR_CODES.SHAPEFILE_MISSING_PRJ_FILE)
    }

    const prjFiles = allFiles.filter((f) =>
      f.lowerName.endsWith(SHAPEFILE_EXTENSIONS.PROJECTION)
    )

    // There seems to be no need to optimise this block, as so far our test files
    // only have a single prj file in the zip.
    for (const prjFile of prjFiles) {
      const stats = await fs.stat(prjFile.fullPath)

      if (stats.size > MAX_PROJECTION_FILE_SIZE_BYTES) {
        logger.warn(
          {
            file: prjFile.relativePath,
            size: stats.size,
            maxSize: MAX_PROJECTION_FILE_SIZE_BYTES,
            tempDir
          },
          `${this.logSystem}: Validation failed - .prj file exceeds size limit`
        )
        throw new Error(GEO_PARSER_ERROR_CODES.SHAPEFILE_PRJ_FILE_TOO_LARGE)
      }
    }

    logger.info(
      { tempDir, fileCount: files.length },
      `${this.logSystem}: Shapefile validation passed`
    )
  }

  /**
   * Find all .shp files in a directory
   */
  async findShapefiles(directory) {
    logger.info(
      { directory },
      `${this.logSystem}: Searching for shapefiles in directory`
    )

    try {
      const files = await Array.fromAsync(
        fs.glob('**/*.[sS][hH][pP]', {
          cwd: directory
        })
      )
      const found = files.map((file) => path.join(directory, file))
      logger.info(
        { found, directory },
        `${this.logSystem}: Found shapefiles in directory`
      )
      return found
    } catch (error) {
      logger.error(
        { directory, error },
        `${this.logSystem}: Error during glob search`
      )
      return []
    }
  }

  /**
   * Validate WGS84 coordinates - throws when validation fails
   * @param {number} x - longitude
   * @param {number } y - latitude
   * @throws
   */
  validateCoordinates(x, y) {
    if (x < LONGITUDE_MIN || x > LONGITUDE_MAX) {
      throw new Error(
        `Invalid longitude received: ${x} from proj4 transformation`
      )
    }
    if (y < LATITUDE_MIN || y > LATITUDE_MAX) {
      throw new Error(
        `Invalid latitude received: ${y} from proj4 transformation`
      )
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
          `${this.logSystem}: Invalid coordinate pair: insufficient elements`
        )
        return
      }
      // Single coordinate pair
      const [x, y] = transformer.forward(coords)
      // proj4 can return Infinity or NaN for invalid transformations
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        logger.error(
          { original: coords, transformed: [x, y] },
          `${this.logSystem}: Invalid transformation result - no transformation has taken place`
        )
        return
      }
      this.validateCoordinates(x, y) // throws if invalid
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
   * @param {string} shpPath - Path to the shapefile
   * @param {Object} transformer - Optional coordinate transformer
   * @returns {Promise<Object>} GeoJSON FeatureCollection with valid features only (features without geometry.coordinates are ignored)
   */
  async parseShapefile(shpPath, transformer = null) {
    const source = await shapefile.open(shpPath)
    const features = []

    while (true) {
      const result = await source.read()
      if (result.done) {
        break
      }

      const feature = result.value

      // Transform coordinates recursively
      if (feature.geometry?.coordinates) {
        if (transformer !== null) {
          this.transformCoordinates(feature.geometry.coordinates, transformer)
        }
        features.push(feature)
      } else {
        logger.warn(
          { feature },
          `${this.logSystem}: ${shpPath} Ignoring feature without geometry.coordinates`
        )
      }
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
    logger.info(
      { directory, basename },
      `${this.logSystem}: Searching for projection file in directory with basename ${basename}`
    )
    if (!basename) {
      logger.error(
        `${this.logSystem}: findProjectionFile: basename arg not provided - no transformation will take place`
      )
      return null
    }
    try {
      const files = await Array.fromAsync(
        fs.glob(`**/${basename}.[pP][rR][jJ]`, {
          cwd: directory
        })
      )
      const paths = files.map((file) => path.join(directory, file))
      if (paths[0]) {
        logger.info(
          { paths },
          `${this.logSystem}: Found projection file: ${paths[0]}`
        )
        return paths[0]
      } else {
        logger.error(
          { paths },
          `${this.logSystem}: No projection file found - coordinates will not be transformed`
        )
        return null
      }
    } catch (error) {
      logger.error(
        { directory, error },
        `${this.logSystem}: Error during glob search for prj file`
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
      logger.error(
        `${this.logSystem}: ERROR: Projection file not found in Shapefile .zip - no coordinate transformation will take place`
      )
      return null
    }

    // Note: file size is validated in validateShapefileContents() during extraction
    return fs.readFile(projFilePath, 'utf-8')
  }

  /**
   * Create a Proj4 CRS transformer
   * @param {string|null} projText - the content of the shapefile *.prj file or null if it was missing
   * @returns {proj4.Converter | null}
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
        `${this.logSystem}: Failed to create proj4 transformer`
      )
      return null
    }
  }

  /**
   * Parse a zip file containing shapefiles and return GeoJSON
   */
  async parseFile(filename) {
    try {
      const extractDir = await this.extractZip(filename)
      logger.debug({ extractDir }, `${this.logSystem}: Extracting zip`)
      try {
        const shapefiles = await this.findShapefiles(extractDir)

        logger.debug(
          {
            shapefiles
          },
          `${this.logSystem}: Shapefiles found before iteration`
        )

        if (shapefiles.length === 0) {
          throw new Error(GEO_PARSER_ERROR_CODES.SHAPEFILE_NOT_FOUND)
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
      if (isGeoParserErrorCode(error.message)) {
        throw error
      }
      throw new Error(`Failed to parse shapefile: ${error.message}`)
    }
  }

  async cleanupTempDirectory(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
      logger.debug({ tempDir }, `${this.logSystem}: Cleaned up temp directory`)
    } catch (error) {
      logger.warn(
        {
          tempDir,
          error
        },
        `${this.logSystem}: ERROR: Failed to clean up temporary directory`
      )
    }
  }
}

export const shapefileParser = new ShapefileParser()
