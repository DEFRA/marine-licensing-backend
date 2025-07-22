import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3'
import { createWriteStream } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { pipeline } from 'stream/promises'
import { config } from '../config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import Boom from '@hapi/boom'

const logger = createLogger()
const awsConfig = config.get('aws')
const cdpEnvironment = config.get('cdpEnvironment')

class BlobService {
  constructor(s3Client) {
    if (s3Client === undefined) {
      const options = {
        region: awsConfig.region,
        requestHandler: {
          requestTimeout: awsConfig.s3.timeout
        }
      }

      if (cdpEnvironment === 'local') {
        options.endpoint = awsConfig.s3.endpoint
        options.forcePathStyle = true
      }

      logger.info(options, 'BlobService: constructor(): S3 client options')
      logger.info(`config: cdpEnvironment is [${cdpEnvironment}]`)

      this.client = new S3Client(options)
    } else {
      this.client = s3Client
    }
    this.timeout = awsConfig.s3.timeout
  }

  async getMetadata(s3Bucket, s3Key) {
    logger.info({ s3Bucket, s3Key }, 'Retrieving S3 object metadata')

    try {
      const command = new HeadObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key
      })

      const response = await this.client.send(command)

      logger.info(
        {
          s3Bucket,
          s3Key,
          contentLength: response.ContentLength,
          lastModified: response.LastModified
        },
        'Successfully retrieved S3 object metadata'
      )

      return {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        etag: response.ETag
      }
    } catch (error) {
      logger.error(
        {
          s3Bucket,
          s3Key,
          error: error.message
        },
        'Failed to retrieve S3 object metadata'
      )

      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        throw Boom.notFound('File not found in S3')
      }

      if (error.name === 'TimeoutError' || error.name === 'RequestTimeout') {
        throw Boom.clientTimeout('S3 operation timed out')
      }

      throw Boom.internal(`S3 metadata retrieval failed: ${error.message}`)
    }
  }

  async downloadFile(s3Bucket, s3Key, tempPath) {
    logger.info({ s3Bucket, s3Key, tempPath }, 'Downloading file from S3')

    try {
      const command = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key
      })

      const response = await this.client.send(command)

      if (!response.Body) {
        throw new Error('No response body received from S3')
      }

      const writeStream = createWriteStream(tempPath)

      // Use pipeline for proper stream handling with timeout
      await pipeline(response.Body, writeStream)

      logger.info(
        {
          s3Bucket,
          s3Key,
          tempPath
        },
        'Successfully downloaded file from S3'
      )

      return tempPath
    } catch (error) {
      logger.error(
        {
          s3Bucket,
          s3Key,
          tempPath,
          error: error.message
        },
        'Failed to download file from S3'
      )

      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        throw Boom.notFound('File not found in S3')
      }

      if (error.name === 'TimeoutError' || error.name === 'RequestTimeout') {
        throw Boom.clientTimeout('S3 download timed out')
      }

      throw Boom.internal(`S3 download failed: ${error.message}`)
    }
  }

  async createTempDirectory() {
    const tempDir = join(tmpdir(), 'geo-parser', randomUUID())
    await mkdir(tempDir, { recursive: true })

    logger.debug({ tempDir }, 'Created temporary directory')
    return tempDir
  }

  async cleanupTempDirectory(tempDir) {
    try {
      await rm(tempDir, { recursive: true, force: true })
      logger.debug({ tempDir }, 'Cleaned up temporary directory')
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

  async validateFileSize(s3Bucket, s3Key) {
    const metadata = await this.getMetadata(s3Bucket, s3Key)
    const maxFileSize = config.get('cdp.maxFileSize')

    if (metadata.size > maxFileSize) {
      logger.warn(
        {
          s3Bucket,
          s3Key,
          fileSize: metadata.size,
          maxFileSize
        },
        'File size exceeds maximum allowed size'
      )

      throw Boom.entityTooLarge(
        `File size (${metadata.size} bytes) exceeds maximum allowed size (${maxFileSize} bytes)`
      )
    }

    return metadata
  }
}

export { BlobService }
export const blobService = new BlobService()
