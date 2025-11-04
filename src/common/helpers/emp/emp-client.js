import Boom from '@hapi/boom'
import { config } from '../../../config.js'
import { StatusCodes } from 'http-status-codes'
import { REQUEST_QUEUE_STATUS } from '../../constants/request-queue.js'
import { transformExemptionToEmpRequest } from './transforms/exemption-to-emp.js'
import { collectionEmpQueue } from '../../constants/db-collections.js'
import { makeEmpRequest } from './helpers.js'

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
    const { response, data } = await makeEmpRequest({
      features,
      apiUrl,
      apiKey
    })
    if (response.res.statusCode !== StatusCodes.OK) {
      throw Boom.badImplementation(
        `EMP API returned status ${response.res.statusCode}`
      )
    }
    return data
  } catch (error) {
    throw Boom.badImplementation(`EMP API request failed`, error)
  }
}
