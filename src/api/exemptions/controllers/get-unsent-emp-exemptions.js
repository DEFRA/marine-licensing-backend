import { StatusCodes } from 'http-status-codes'
import { collectionEmpQueue } from '../../../common/constants/db-collections.js'

export const getUnsentEmpExemptionsController = {
  handler: async (request, h) => {
    const { db } = request

    // Get all application references that are already in the EMP queue
    const queuedExemptions = await db
      .collection(collectionEmpQueue)
      .find({})
      .project({ applicationReferenceNumber: 1 })
      .toArray()

    const queuedApplicationRefs = new Set(
      queuedExemptions.map((item) => item.applicationReferenceNumber)
    )

    // Get all ACTIVE exemptions
    const exemptions = await db
      .collection('exemptions')
      .find({
        status: 'ACTIVE'
      })
      .sort({ submittedAt: -1 })
      .toArray()

    // Filter out exemptions that are already in the queue
    const unsentExemptions = exemptions.filter(
      (exemption) => !queuedApplicationRefs.has(exemption.applicationReference)
    )

    return h
      .response({
        message: 'success',
        value: unsentExemptions
      })
      .code(StatusCodes.OK)
  }
}
