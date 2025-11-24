import Boom from '@hapi/boom'
import { config } from '../../../config.js'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import { transformExemptionToEmpRequest } from './transforms/exemption-to-emp.js'
import { collectionEmpQueue } from '../../constants/db-collections.js'
import { addFeatures } from '@esri/arcgis-rest-feature-service'
import { createLogger } from '../../helpers/logging/logger.js'

const logger = createLogger()

export const sendExemptionToEmp = async (server, queueItem) => {
  const { apiUrl, apiKey } = config.get('exploreMarinePlanning')
  const { applicationReferenceNumber } = queueItem

  const exemption = await server.db.collection('exemptions').findOne({
    applicationReference: applicationReferenceNumber
  })

  if (!exemption) {
    throw Boom.notFound(
      `Exemption not found for applicationReference: ${applicationReferenceNumber}`
    )
  }

  await server.db.collection(collectionEmpQueue).updateOne(
    { _id: exemption._id },
    {
      $set: {
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        updatedAt: new Date()
      }
    }
  )

  try {
    const features = transformExemptionToEmpRequest({
      exemption,
      applicantName: queueItem.userName
    })
    // https://developers.arcgis.com/rest/services-reference/enterprise/add-features/
    const { addResults } = await addFeatures({
      url: `${apiUrl}/addFeatures`,
      features,
      params: {
        token: apiKey
      }
    })
    const result = addResults?.[0]
    if (!result?.success) {
      const errorMessage = `EMP addFeatures failed: ${result?.error?.description}`
      const statusCode = result?.error?.code
      logger.error(
        {
          error: {
            message: errorMessage,
            code: 'EMP_API_ERROR'
          },
          http: statusCode
            ? {
                response: {
                  status_code: statusCode
                }
              }
            : undefined,
          service: 'arcgis',
          operation: 'addFeatures',
          applicationReference: applicationReferenceNumber
        },
        errorMessage
      )
      throw Boom.badImplementation(errorMessage)
    }

    logger.info(
      {
        http: {
          response: {
            status_code: 200
          }
        },
        service: 'arcgis',
        operation: 'addFeatures',
        applicationReference: applicationReferenceNumber
      },
      'Successfully sent exemption to ArcGIS/EMP'
    )

    return addResults
  } catch (error) {
    const statusCode =
      error.response?.statusCode ||
      error.statusCode ||
      error.status ||
      error.code
    logger.error(
      {
        error: {
          message: error.message || String(error),
          stack_trace: error.stack,
          type: error.name || error.constructor?.name || 'Error',
          code: error.code || 'EMP_API_ERROR'
        },
        http: statusCode
          ? {
              response: {
                status_code: statusCode
              }
            }
          : undefined,
        service: 'arcgis',
        operation: 'addFeatures',
        applicationReference: applicationReferenceNumber
      },
      `EMP addFeatures failed: ${error.message}`
    )
    throw Boom.badImplementation(`EMP addFeatures failed: ${error.message}`)
  }
}
