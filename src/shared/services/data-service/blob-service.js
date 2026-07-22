import { HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { config } from '../../../config.js'
import {
  createLogger,
  structureErrorForECS
} from '../../common/helpers/logging/logger.js'
import Boom from '@hapi/boom'
import { getS3Client } from './s3-client.js'

const logger = createLogger()
const awsConfig = config.get('aws')
const cdpEnvironment = config.get('cdpEnvironment')
const FILE_NOT_FOUND_IN_S3 = 'File not found in S3'

class BlobService {
  logSystem = 'FileUpload:BlobService'
  constructor(s3Client) {
    logger.info(
      `${this.logSystem}: config: cdpEnvironment is [${cdpEnvironment}], S3_ENDPOINT is ${awsConfig.s3.endpoint}`
    )

    this.client = s3Client ?? getS3Client()
    this.timeout = awsConfig.s3.timeout
  }

  async getMetadata(s3Bucket, s3Key) {
    logger.info(
      `${this.logSystem}: Retrieving S3 object metadata for ${s3Bucket}/${s3Key}`
    )

    try {
      const command = new HeadObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key
      })
      const response = await this.client.send(command)

      logger.info(
        `${this.logSystem}: Successfully retrieved S3 object metadata for ${s3Bucket}/${s3Key}, size ${response.ContentLength} bytes`
      )
      return {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        etag: response.ETag
      }
    } catch (error) {
      logger.error(
        structureErrorForECS(error),
        `${this.logSystem}: Failed to retrieve S3 object metadata`
      )

      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        throw Boom.notFound(FILE_NOT_FOUND_IN_S3)
      }

      if (error.name === 'TimeoutError' || error.name === 'RequestTimeout') {
        throw Boom.clientTimeout('S3 operation timed out')
      }

      throw Boom.internal(`S3 metadata retrieval failed: ${error.message}`)
    }
  }

  async downloadFile(s3Bucket, s3Key, tempPath) {
    logger.info(`${this.logSystem}: Downloading file from S3`)

    try {
      const command = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key
      })

      const response = await this.client.send(command)

      if (!response.Body) {
        const errorMessage = 'No response body received from S3'
        const error = new Error(errorMessage)
        error.code = 'S3_NO_RESPONSE_BODY'
        logger.error(
          structureErrorForECS(error),
          `${this.logSystem}: ${errorMessage}`
        )
        throw error
      }

      const writeStream = createWriteStream(tempPath)

      // Use pipeline for proper stream handling with timeout
      await pipeline(response.Body, writeStream)

      logger.info(`${this.logSystem}: Successfully downloaded file from S3`)

      return tempPath
    } catch (error) {
      logger.error(
        structureErrorForECS(error),
        `${this.logSystem}: ERROR: Failed to download file from S3`
      )

      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        throw Boom.notFound(FILE_NOT_FOUND_IN_S3)
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

    logger.debug(`${this.logSystem}: Created temporary directory ${tempDir}`)
    return tempDir
  }

  async cleanupTempDirectory(tempDir) {
    try {
      await rm(tempDir, { recursive: true, force: true })
      logger.debug(
        `${this.logSystem}: Cleaned up temporary directory ${tempDir}`
      )
    } catch (error) {
      logger.warn(
        structureErrorForECS(error),
        `${this.logSystem}: Failed to clean up temporary directory ${tempDir}`
      )
    }
  }

  async validateFileSize(s3Bucket, s3Key) {
    const metadata = await this.getMetadata(s3Bucket, s3Key)
    const maxFileSize = config.get('cdp.maxFileSize')

    if (metadata.size > maxFileSize) {
      const sizeError = new Error('File size exceeds maximum allowed size')
      sizeError.code = 'FILE_SIZE_EXCEEDED'
      logger.error(
        structureErrorForECS(sizeError),
        `${this.logSystem}: File size exceeds maximum allowed size`
      )

      throw Boom.entityTooLarge(
        `File size (${metadata.size} bytes) exceeds maximum allowed size (${maxFileSize} bytes)`
      )
    }

    return metadata
  }

  async getPresignedUrl(s3Bucket, s3Key, expiresInSeconds = 3600) {
    logger.info(
      `${this.logSystem}: Generating presigned URL for ${s3Bucket}/${s3Key}`
    )

    try {
      const command = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key
      })

      const url = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds
      })

      logger.info(
        `${this.logSystem}: Successfully generated presigned URL for ${s3Bucket}/${s3Key}`
      )

      return url
    } catch (error) {
      logger.error(
        structureErrorForECS(error),
        `${this.logSystem}: Failed to generate presigned URL`
      )

      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        throw Boom.notFound(FILE_NOT_FOUND_IN_S3)
      }

      if (error.name === 'TimeoutError' || error.name === 'RequestTimeout') {
        throw Boom.clientTimeout('S3 operation timed out')
      }

      throw Boom.internal(
        `S3 presigned URL generation failed: ${error.message}`
      )
    }
  }
}

export { BlobService }
export const blobService = new BlobService()
