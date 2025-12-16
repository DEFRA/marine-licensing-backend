import { S3Client } from '@aws-sdk/client-s3'
import { config, isDevelopment } from '../../config.js'

const awsConfig = config.get('aws')

const s3ClientOptions = {
  region: awsConfig.region,
  endpoint: awsConfig.s3.endpoint,
  requestHandler: {
    requestTimeout: awsConfig.s3.timeout
  },
  forcePathStyle: isDevelopment // local only
}

let s3ClientInstance = null

export const getS3Client = () => {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client(s3ClientOptions)
  }
  return s3ClientInstance
}
