import Boom from '@hapi/boom'
import { config } from '../../../config.js'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import { transformExemptionToEmpRequest } from './transforms/exemption-to-emp.js'
import { collectionEmpQueue } from '../../constants/db-collections.js'
import { addFeatures } from '@esri/arcgis-rest-feature-service'

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

  const features = transformExemptionToEmpRequest({
    exemption,
    applicantName: queueItem.userName
  })

  try {
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
      throw Boom.badImplementation(
        `EMP addFeatures failed: ${result?.error?.description}`
      )
    }
    return addResults
  } catch (error) {
    throw Boom.badImplementation(`EMP addFeatures failed: ${error.message}`)
  }
}
