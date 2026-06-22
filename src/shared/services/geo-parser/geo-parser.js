import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import Boom from '@hapi/boom'
import {
  createLogger,
  structureErrorForECS
} from '../../common/helpers/logging/logger.js'
import { blobService } from '../data-service/blob-service.js'
import { GEO_PARSER_ERROR_CODES, isGeoParserErrorCode } from './error-codes.js'

const logger = createLogger()

const INVALID_FEATURE_GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString'
])

/** Max recursion depth for nested GeometryCollections (RFC 7946 §3.1.8). */
const MAX_GEOMETRY_COLLECTION_DEPTH = 20

/**
 * @param {object|null|undefined} geometry
 * @param {number} depth
 * @returns {string|null} invalid primitive type, or null if allowed
 * @throws {Error} GEO_PARSER_ERROR_CODES.GEOMETRY_NESTING_TOO_DEEP if depth exceeded
 */
function findInvalidGeometryType(geometry, depth = 0) {
  if (depth > MAX_GEOMETRY_COLLECTION_DEPTH) {
    throw new Error(GEO_PARSER_ERROR_CODES.GEOMETRY_NESTING_TOO_DEEP)
  }

  if (!geometry || typeof geometry !== 'object') {
    return null
  }

  if (INVALID_FEATURE_GEOMETRY_TYPES.has(geometry.type)) {
    return geometry.type
  }

  if (
    geometry.type === 'GeometryCollection' &&
    Array.isArray(geometry.geometries)
  ) {
    for (const childGeometry of geometry.geometries) {
      const invalidType = findInvalidGeometryType(childGeometry, depth + 1)
      if (invalidType) {
        return invalidType
      }
    }
  }

  return null
}

export class GeoParser {
  processingTimeout = 30_000 // 30 seconds
  memoryLimit = 524_288_000 // 500MB in bytes
  logSystem = 'FileUpload:GeoParser'

  async extract(s3Bucket, s3Key, fileType, { singleSiteOnly } = {}) {
    logger.info(
      `${this.logSystem}: Starting geo-parser extraction for ${fileType} from ${s3Bucket}/${s3Key}`
    )

    let tempDir = null

    try {
      tempDir = await blobService.createTempDirectory()
      await blobService.validateFileSize(s3Bucket, s3Key)

      const tempFilePath = join(tempDir, `file_${Date.now()}`)
      await blobService.downloadFile(s3Bucket, s3Key, tempFilePath)

      const geoJSON = await this.parseFile(tempFilePath, fileType)

      this.validateGeoJSON(geoJSON)

      this.validateFeatureGeometryTypes(geoJSON)

      if (singleSiteOnly) {
        this.validateSingleSite(geoJSON)
      }

      logger.info(
        `${this.logSystem}: Successfully extracted GeoJSON for ${fileType} from ${s3Bucket}/${s3Key}, ${geoJSON.features?.length || 0} features`
      )

      return geoJSON
    } catch (error) {
      logger.error(
        structureErrorForECS(error),
        `${this.logSystem}: ERROR: Failed to extract GeoJSON`
      )

      if (error.isBoom) {
        throw error
      }

      if (isGeoParserErrorCode(error.message)) {
        throw Boom.badRequest(error.message)
      }

      throw Boom.internal(`GeoJSON extraction failed: ${error.message}`)
    } finally {
      if (tempDir) {
        setImmediate(() => {
          blobService.cleanupTempDirectory(tempDir)
        })
      }
    }
  }

  async parseFile(filePath, fileType) {
    logger.info(`${this.logSystem}: Parsing file of type ${fileType}`)

    // Use worker threads for CPU-intensive parsing to prevent blocking
    return new Promise((resolve, reject) => {
      // This is relative to the project root
      const worker = new Worker('./src/shared/services/geo-parser/worker.js', {
        workerData: { filePath, fileType }
      })

      const timeout = setTimeout(() => {
        worker.terminate()
        const timeoutError = new Error('Processing timeout exceeded')
        timeoutError.code = 'PROCESSING_TIMEOUT'
        logger.error(
          structureErrorForECS(timeoutError),
          `${this.logSystem}: Processing timeout exceeded: worker terminated`
        )
        reject(timeoutError)
      }, this.processingTimeout)

      worker.on('message', (result) => {
        clearTimeout(timeout)

        if (result.error) {
          const parseError = new Error(result.error)
          parseError.code = 'PARSE_ERROR'
          logger.error(
            structureErrorForECS(parseError),
            `${this.logSystem}: Failed to parse file`
          )
          reject(parseError)
        } else {
          logger.info(
            `${this.logSystem}: File parsed successfully (${fileType})`
          )
          resolve(result.geoJSON)
        }
      })

      worker.on('error', (error) => {
        clearTimeout(timeout)
        logger.error(
          structureErrorForECS(error),
          `${this.logSystem}: Worker error during parsing`
        )
        reject(new Error(`Worker error: ${error.message}`))
      })

      worker.on('exit', (code) => {
        clearTimeout(timeout)
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`))
        }
      })
    })
  }

  validateGeoJSON(geoJSON) {
    if (!geoJSON || typeof geoJSON !== 'object') {
      throw Boom.internal('Invalid GeoJSON: not an object')
    }

    if (geoJSON.type !== 'FeatureCollection' && geoJSON.type !== 'Feature') {
      throw Boom.internal('Invalid GeoJSON: missing or invalid type')
    }

    if (geoJSON.type === 'FeatureCollection') {
      if (!Array.isArray(geoJSON.features)) {
        throw Boom.internal('Invalid GeoJSON: features must be an array')
      }

      if (geoJSON.features.length === 0) {
        logger.warn(
          `${this.logSystem}: Validation failed - GeoJSON contains no features`
        )
        throw new Error(GEO_PARSER_ERROR_CODES.NO_SITE_BOUNDARIES)
      }
    }

    // Check memory usage (rough estimate)
    const jsonString = JSON.stringify(geoJSON)
    const memoryUsage = Buffer.byteLength(jsonString, 'utf8')

    if (memoryUsage > this.memoryLimit) {
      throw Boom.entityTooLarge(
        `GeoJSON too large: ${memoryUsage} bytes exceeds limit of ${this.memoryLimit} bytes`
      )
    }

    logger.debug(
      `${this.logSystem}: validation passed - type ${geoJSON.type}, ${geoJSON.features?.length || 0} features, ${memoryUsage} bytes`
    )

    return true
  }

  /**
   * Reject the entire file if any feature is a point or line site.
   * Per acceptance criteria: only polygon-like sites are permitted; the file
   * is rejected if any feature is a Point, MultiPoint, LineString, or
   * MultiLineString.
   *
   * @param {object} geoJSON - parsed GeoJSON FeatureCollection or Feature
   * @throws {Error} with code FEATURES_CONTAIN_POINT_OR_LINE if any feature
   *   has a point or line geometry
   * @throws {Error} with code GEOMETRY_NESTING_TOO_DEEP if GeometryCollection
   *   nesting exceeds the configured maximum depth
   */
  validateFeatureGeometryTypes(geoJSON) {
    const features =
      geoJSON.type === 'FeatureCollection' ? geoJSON.features : [geoJSON]

    if (!Array.isArray(features)) {
      return true
    }

    for (const feature of features) {
      const invalidGeometryType = findInvalidGeometryType(feature?.geometry, 0)
      if (invalidGeometryType) {
        logger.warn(
          `${this.logSystem}: Validation failed - feature contains invalid geometry type '${invalidGeometryType}'; only polygon sites are permitted`
        )
        throw new Error(GEO_PARSER_ERROR_CODES.FEATURES_CONTAIN_POINT_OR_LINE)
      }
    }

    return true
  }

  /**
   * Reject the file if it contains more than one feature when only a single
   * site is permitted.
   *
   * @param {object} geoJSON - parsed GeoJSON FeatureCollection or Feature
   * @throws {Error} with code SINGLE_SITE_ONLY if more than one feature is present
   */
  validateSingleSite(geoJSON) {
    const features =
      geoJSON.type === 'FeatureCollection' ? geoJSON.features : [geoJSON]

    if (Array.isArray(features) && features.length > 1) {
      logger.warn(
        `${this.logSystem}: Validation failed - file contains ${features.length} sites but only one is permitted`
      )
      throw new Error(GEO_PARSER_ERROR_CODES.SINGLE_SITE_ONLY)
    }

    return true
  }
}

export const geoParser = new GeoParser()
