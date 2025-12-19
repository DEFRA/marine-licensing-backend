import { S3Client } from '@aws-sdk/client-s3'
import { config } from '../../config.js'
const cdpEnvironment = config.get('cdpEnvironment')

const awsConfig = config.get('aws')

const s3ClientOptions = {
  region: awsConfig.region,
  endpoint: awsConfig.s3.endpoint,
  maxAttempts: 3,
  requestHandler: {
    requestTimeout: awsConfig.s3.timeout
  },
  // isDevelopment does not work, because on Github ci NODE_ENV = 'production'
  forcePathStyle: cdpEnvironment === 'local'
}

let s3ClientInstance = null

export const getS3Client = () => {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client(s3ClientOptions)
  }
  return s3ClientInstance
}
