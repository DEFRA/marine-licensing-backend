import Boom from '@hapi/boom'
import { siteDetailsSchema } from '../../models/site-details/site-details.js'
import { createActivityDetails } from '../helpers/create-empty-activity-details.js'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { tenMegaBytes } from '../../../shared/constants/site-details.js'
import { buildPolicyResetFields } from '../helpers/policy-reset.js'

export const updateSiteDetailsController = {
  options: {
    payload: {
      parse: true,
      output: 'data',
      maxBytes: tenMegaBytes
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: siteDetailsSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const { siteDetails, id, updatedAt, updatedBy } = payload

      const siteDetailsWithActivity = siteDetails.map((site) =>
        site.activityDetails
          ? site
          : { ...site, activityDetails: [createActivityDetails()] }
      )

      const _id = ObjectId.createFromHexString(id)
      const collection = db.collection(collectionMarineLicences)

      const existing = await collection.findOne(
        { _id },
        { projection: { policyJobId: 1 } }
      )

      const result = await collection.updateOne(
        { _id },
        {
          $set: {
            siteDetails: siteDetailsWithActivity,
            ...buildPolicyResetFields(id, existing, siteDetailsWithActivity),
            updatedAt,
            updatedBy
          }
        }
      )

      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine licence not found')
      }

      return h
        .response({
          message: 'success'
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }

      throw Boom.internal(`Error updating site details: ${error.message}`)
    }
  }
}
