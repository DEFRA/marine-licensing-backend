import { Worker } from 'worker_threads'
import { join } from 'path'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { blobService } from '../blob-service.js'
import { kmlParser } from './kml-parser.js'
import { shapefileParser } from './shapefile-parser.js'
import Boom from '@hapi/boom'

const logger = createLogger()

export class GeoParser {
  constructor() {
    this.processingTimeout = 30_000 // 30 seconds
    this.memoryLimit = 524_288_000 // 500MB in bytes
  }

  async extract(s3Bucket, s3Key, fileType) {
    logger.info({ s3Bucket, s3Key, fileType }, 'Starting geo-parser extraction')

    let tempDir = null

    try {
      // Create temporary directory
      tempDir = await blobService.createTempDirectory()

      // Validate file size before download
      await blobService.validateFileSize(s3Bucket, s3Key)

      // Download file to temp directory
      const tempFilePath = join(tempDir, `file_${Date.now()}`)
      await blobService.downloadFile(s3Bucket, s3Key, tempFilePath)

      // Parse the file based on type
      const geoJSON = await this.parseFile(tempFilePath, fileType)

      // Validate the result
      this.validateGeoJSON(geoJSON)

      logger.info(
        {
          s3Bucket,
          s3Key,
          fileType,
          featureCount: geoJSON.features?.length || 0
        },
        'Successfully extracted GeoJSON'
      )

      return geoJSON
    } catch (error) {
      logger.error(
        {
          s3Bucket,
          s3Key,
          fileType,
          error: error.message
        },
        'Failed to extract GeoJSON'
      )

      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(`GeoJSON extraction failed: ${error.message}`)
    } finally {
      // Clean up temporary directory
      if (tempDir) {
        // Use setImmediate to clean up asynchronously
        setImmediate(() => {
          blobService.cleanupTempDirectory(tempDir)
        })
      }
    }
  }

  async parseFile(filePath, fileType) {
    logger.info({ filePath, fileType }, 'Parsing file')

    // Use worker threads for CPU-intensive parsing to prevent blocking
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate()
        reject(Boom.clientTimeout('Processing timeout exceeded'))
      }, this.processingTimeout)

      // This is relative to the project root
      const worker = new Worker('./src/services/geo-parser/worker.js', {
        workerData: { filePath, fileType }
      })

      worker.on('message', (result) => {
        clearTimeout(timeout)

        if (result.error) {
          reject(new Error(result.error))
        } else {
          resolve(result.geoJSON)
        }
      })

      worker.on('error', (error) => {
        clearTimeout(timeout)
        logger.error(
          {
            filePath,
            fileType,
            error: error.message
          },
          'Worker error during parsing'
        )
        reject(Boom.internal(`Worker error: ${error.message}`))
      })

      worker.on('exit', (code) => {
        clearTimeout(timeout)
        if (code !== 0) {
          reject(Boom.internal(`Worker stopped with exit code ${code}`))
        }
      })
    })
  }

  // For now, we'll parse directly without worker threads as it's simpler
  // In a production environment, we'd use the worker thread approach above
  async parseFileDirectly(filePath, fileType) {
    logger.debug({ filePath, fileType }, 'Parsing file directly')

    try {
      let geoJSON

      if (fileType === 'kml') {
        geoJSON = await kmlParser.parseFile(filePath)
      } else if (fileType === 'shapefile') {
        geoJSON = await shapefileParser.parseFile(filePath)
      } else {
        throw Boom.badRequest(`Unsupported file type: ${fileType}`)
      }

      return geoJSON
    } catch (error) {
      logger.error(
        {
          filePath,
          fileType,
          error: error.message
        },
        'Failed to parse file directly'
      )

      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(`File parsing failed: ${error.message}`)
    }
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
        logger.warn('GeoJSON contains no features')
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
      {
        type: geoJSON.type,
        featureCount: geoJSON.features?.length || 0,
        memoryUsage
      },
      'GeoJSON validation passed'
    )

    return true
  }
}

export const geoParser = new GeoParser()
