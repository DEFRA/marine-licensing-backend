import Boom from '@hapi/boom'
import { config } from '../../../../config.js'
import {
  REQUEST_QUEUE_STATUS,
  EMP_REQUEST_ACTIONS
} from '../../constants/request-queue.js'
import { transformExemptionToEmpRequest } from './transforms/exemption-to-emp.js'
import { collectionEmpQueue } from '../../constants/db-collections.js'
import { addFeatures, updateFeatures } from '@esri/arcgis-rest-feature-service'
import { createLogger } from '../logging/logger.js'
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

const findFailedAddResult = (addResults) =>
  addResults?.find((r) => !r?.success || !r.objectId)

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
    // rollbackOnFailure: true (the default) ensures that if any feature in the
    // batch fails, ArcGIS rolls back the successful ones — this keeps queue
    // retries safe since addFeatures is not otherwise idempotent.
    const { addResults } = await addFeatures({
      url: `${apiUrl}/addFeatures`,
      features,
      params: {
        token: apiKey,
        rollbackOnFailure: true
      }
    })

    const failed = findFailedAddResult(addResults)
    if (failed || !addResults?.length) {
      handleEmpApiError(failed, applicationReferenceNumber)
    }

    logEmpSuccess(applicationReferenceNumber)

    return { objectIds: addResults.map((r) => r.objectId) }
  } catch (error) {
    logEmpExceptionError(error, applicationReferenceNumber)
    throw Boom.badImplementation(`EMP addFeatures failed: ${error.message}`)
  }
}

const getEmpFeatureIdsFromQueue = async (db, applicationReferenceNumber) => {
  const priorItem = await db.collection(collectionEmpQueue).findOne({
    applicationReferenceNumber,
    action: { $ne: EMP_REQUEST_ACTIONS.WITHDRAW },
    $or: [
      { empFeatureIds: { $exists: true, $ne: null } },
      { empFeatureId: { $exists: true, $ne: null } }
    ]
  })

  if (!priorItem) {
    return []
  }

  if (
    Array.isArray(priorItem.empFeatureIds) &&
    priorItem.empFeatureIds.length > 0
  ) {
    return priorItem.empFeatureIds
  }

  // Backwards compatibility for queue items persisted before ML-1222.
  if (priorItem.empFeatureId == null) {
    return []
  }
  return [priorItem.empFeatureId]
}

const logEmpUpdateSuccess = (applicationReference) => {
  logger.info(
    {
      http: {
        response: {
          status_code: 200
        }
      },
      service: 'arcgis',
      operation: 'updateFeatures',
      applicationReference
    },
    'Successfully updated exemption status in ArcGIS/EMP'
  )
}

const logEmpUpdateApiError = (
  errorMessage,
  statusCode,
  applicationReference
) => {
  logger.error(
    {
      error: {
        message: errorMessage,
        code: 'EMP_API_ERROR'
      },
      http: buildHttpLogContext(statusCode),
      service: 'arcgis',
      operation: 'updateFeatures',
      applicationReference
    },
    errorMessage
  )
}

const logEmpUpdateExceptionError = (error, applicationReference) => {
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
      operation: 'updateFeatures',
      applicationReference
    },
    `EMP updateFeatures failed: ${error.message}`
  )
}

export const withdrawExemptionFromEmp = async (server, queueItem) => {
  const { apiUrl, apiKey } = config.get('exploreMarinePlanning')
  const { applicationReferenceNumber } = queueItem

  const empFeatureIds = await getEmpFeatureIdsFromQueue(
    server.db,
    applicationReferenceNumber
  )

  if (empFeatureIds.length === 0) {
    throw Boom.badImplementation(
      `EMP withdraw failed: no objectId found for ${applicationReferenceNumber}`
    )
  }

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
    // https://developers.arcgis.com/rest/services-reference/enterprise/update-features/
    // rollbackOnFailure: true (the default) ensures partial failures are
    // rolled back, so a queue retry is safe.
    const { updateResults } = await updateFeatures({
      url: `${apiUrl}/updateFeatures`,
      features: empFeatureIds.map((objectId) => ({
        attributes: {
          OBJECTID: objectId,
          Status: 'Withdrawn'
        }
      })),
      params: {
        token: apiKey,
        rollbackOnFailure: true
      }
    })

    const failed = updateResults?.find((r) => !r?.success)
    if (failed || !updateResults?.length) {
      const errorMessage = `EMP updateFeatures failed: ${failed?.error?.description || 'Unknown error'}`
      const statusCode = failed?.error?.code || null
      logEmpUpdateApiError(errorMessage, statusCode, applicationReferenceNumber)
      throw Boom.badImplementation(errorMessage)
    }

    logEmpUpdateSuccess(applicationReferenceNumber)

    return { objectIds: updateResults.map((r) => r.objectId) }
  } catch (error) {
    if (error.isBoom) {
      throw error
    }
    logEmpUpdateExceptionError(error, applicationReferenceNumber)
    throw Boom.badImplementation(`EMP updateFeatures failed: ${error.message}`)
  }
}
