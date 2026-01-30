import Boom from '@hapi/boom'
import { config } from '../../../../config.js'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import { transformExemptionToEmpRequest } from './transforms/exemption-to-emp.js'
import { collectionEmpQueue } from '../../constants/db-collections.js'
import { addFeatures } from '@esri/arcgis-rest-feature-service'
import { createLogger } from '../../helpers/logging/logger.js'
import { ExemptionService } from '../../../../exemptions/api/services/exemption.service.js'

const logger = createLogger()

const extractStatusCodeFromError = (error) => {
  return (
    error.response?.statusCode || error.statusCode || error.status || error.code
  )
}

const buildHttpLogContext = (statusCode) => {
  return statusCode
    ? {
        response: {
          status_code: statusCode
        }
      }
    : undefined
}

const logEmpSuccess = (applicationReference) => {
  logger.info(
    {
      http: {
        response: {
          status_code: 200
        }
      },
      service: 'arcgis',
      operation: 'addFeatures',
      applicationReference
    },
    'Successfully sent exemption to ArcGIS/EMP'
  )
}

const logEmpApiError = (errorMessage, statusCode, applicationReference) => {
  logger.error(
    {
      error: {
        message: errorMessage,
        code: 'EMP_API_ERROR'
      },
      http: buildHttpLogContext(statusCode),
      service: 'arcgis',
      operation: 'addFeatures',
      applicationReference
    },
    errorMessage
  )
}

const logEmpExceptionError = (error, applicationReference) => {
  const statusCode = extractStatusCodeFromError(error)
  logger.error(
    {
      error: {
        message: error.message || String(error),
        stack_trace: error.stack,
        type: error.name || error.constructor?.name || 'Error',
        code: error.code || 'EMP_API_ERROR'
      },
      http: buildHttpLogContext(statusCode),
      service: 'arcgis',
      operation: 'addFeatures',
      applicationReference
    },
    `EMP addFeatures failed: ${error.message}`
  )
}

const handleEmpApiError = (result, applicationReference) => {
  const errorMessage = `EMP addFeatures failed: ${result?.error?.description || 'Unknown error'}`
  const statusCode = result?.error?.code || null
  logEmpApiError(errorMessage, statusCode, applicationReference)
  throw Boom.badImplementation(errorMessage)
}

export const sendExemptionToEmp = async (server, queueItem) => {
  const { apiUrl, apiKey } = config.get('exploreMarinePlanning')
  const { applicationReferenceNumber } = queueItem

  const exemptionService = new ExemptionService({ db: server.db, logger })
  const exemption = await exemptionService.getExemptionByApplicationReference({
    applicationReference: applicationReferenceNumber
  })

  await server.db.collection(collectionEmpQueue).updateOne(
    { _id: queueItem._id },
    {
      $set: {
        status: REQUEST_QUEUE_STATUS.IN_PROGRESS,
        updatedAt: new Date()
      }
    }
  )

  try {
    const features = transformExemptionToEmpRequest({
      exemption
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
    if (!result?.success || !result.objectId) {
      handleEmpApiError(result, applicationReferenceNumber)
    }

    logEmpSuccess(applicationReferenceNumber)

    return result
  } catch (error) {
    logEmpExceptionError(error, applicationReferenceNumber)
    throw Boom.badImplementation(`EMP addFeatures failed: ${error.message}`)
  }
}
