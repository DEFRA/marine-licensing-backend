import Boom from '@hapi/boom'
import { join } from 'path'
import { Worker } from 'worker_threads'
import { createLogger } from '../../common/helpers/logging/logger.js'
import { blobService } from '../blob-service.js'

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
      if (tempDir) {
        setImmediate(() => {
          blobService.cleanupTempDirectory(tempDir)
        })
      }
    }
  }

  async parseFile(filePath, fileType) {
    logger.info({ filePath, fileType }, 'Parsing file')
    return this.createWorkerPromise(filePath, fileType)
  }

  createWorkerPromise(filePath, fileType) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./src/services/geo-parser/worker.js', {
        workerData: { filePath, fileType }
      })

      const context = {
        worker,
        timeout: this.setupTimeout(worker, reject),
        resolve,
        reject,
        filePath,
        fileType
      }

      this.setupWorkerHandlers(context)
    })
  }

  setupTimeout(worker, reject) {
    return setTimeout(() => {
      worker.terminate()
      reject(new Error('Processing timeout exceeded'))
    }, this.processingTimeout)
  }

  setupWorkerHandlers(context) {
    const { worker, timeout, resolve, reject, filePath, fileType } = context

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
        { filePath, fileType, error: error.message },
        'Worker error during parsing'
      )
      reject(new Error(`Worker error: ${error.message}`))
    })

    worker.on('exit', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`))
      }
    })
  }

  validateGeoJSON(geoJSON) {
    this.validateStructure(geoJSON)
    this.validateFeatureCollection(geoJSON)
    this.validateMemoryUsage(geoJSON)

    logger.debug(
      {
        type: geoJSON.type,
        featureCount: geoJSON.features?.length || 0,
        memoryUsage: Buffer.byteLength(JSON.stringify(geoJSON), 'utf8')
      },
      'GeoJSON validation passed'
    )

    return true
  }

  validateStructure(geoJSON) {
    if (!geoJSON || typeof geoJSON !== 'object') {
      throw Boom.internal('Invalid GeoJSON: not an object')
    }

    if (geoJSON.type !== 'FeatureCollection' && geoJSON.type !== 'Feature') {
      throw Boom.internal('Invalid GeoJSON: missing or invalid type')
    }
  }

  validateFeatureCollection(geoJSON) {
    if (geoJSON.type === 'FeatureCollection') {
      if (!Array.isArray(geoJSON.features)) {
        throw Boom.internal('Invalid GeoJSON: features must be an array')
      }

      if (geoJSON.features.length === 0) {
        logger.warn('GeoJSON contains no features')
      }
    }
  }

  validateMemoryUsage(geoJSON) {
    const jsonString = JSON.stringify(geoJSON)
    const memoryUsage = Buffer.byteLength(jsonString, 'utf8')

    if (memoryUsage > this.memoryLimit) {
      throw Boom.entityTooLarge(
        `GeoJSON too large: ${memoryUsage} bytes exceeds limit of ${this.memoryLimit} bytes`
      )
    }
  }
}

export const geoParser = new GeoParser()
