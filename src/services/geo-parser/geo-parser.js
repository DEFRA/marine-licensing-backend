import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import Boom from '@hapi/boom'
import {
  createLogger,
  structureErrorForECS
} from '../../common/helpers/logging/logger.js'
import { blobService } from '../blob-service.js'
import { isGeoParserErrorCode } from './error-codes.js'

const logger = createLogger()

export class GeoParser {
  processingTimeout = 30_000 // 30 seconds
  memoryLimit = 524_288_000 // 500MB in bytes
  logSystem = 'FileUpload:GeoParser'

  async extract(s3Bucket, s3Key, fileType) {
    logger.info(
      { s3Bucket, s3Key, fileType },
      `${this.logSystem}: Starting geo-parser extraction`
    )

    let tempDir = null

    try {
      tempDir = await blobService.createTempDirectory()
      await blobService.validateFileSize(s3Bucket, s3Key)

      const tempFilePath = join(tempDir, `file_${Date.now()}`)
      await blobService.downloadFile(s3Bucket, s3Key, tempFilePath)

      const geoJSON = await this.parseFile(tempFilePath, fileType)

      this.validateGeoJSON(geoJSON)

      logger.info(
        {
          s3Bucket,
          s3Key,
          fileType,
          featureCount: geoJSON.features?.length || 0
        },
        `${this.logSystem}: Successfully extracted GeoJSON`
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
    logger.info({ fileType }, `${this.logSystem}: Parsing file`)

    // Use worker threads for CPU-intensive parsing to prevent blocking
    return new Promise((resolve, reject) => {
      // This is relative to the project root
      const worker = new Worker('./src/services/geo-parser/worker.js', {
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
            { fileType },
            `${this.logSystem}: File parsed successfully`
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
        logger.warn(`${this.logSystem}: GeoJSON contains no features`)
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
      `${this.logSystem}: validation passed`
    )

    return true
  }
}

export const geoParser = new GeoParser()
