import { StatusCodes } from 'http-status-codes'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'

export const getBackfillAreasExemptionsController = {
  handler: async (request, h) => {
    const { db } = request

    const backfillAreas = await db
      .collection(collectionExemptions)
      .find({
        status: EXEMPTION_STATUS.ACTIVE,
        areaBackfillCompleteAt: { $exists: false },
        $or: [
          { coastalOperationsAreas: { $exists: false } },
          { marinePlanAreas: { $exists: false } }
        ]
      })
      .sort({ submittedAt: -1 })
      .project({
        _id: 1,
        projectName: 1,
        applicationReference: 1,
        status: 1,
        submittedAt: 1
      })
      .toArray()

    return h
      .response({
        message: 'success',
        value: {
          backfillAreas
        }
      })
      .code(StatusCodes.OK)
  }
}
