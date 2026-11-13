import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { publicRegisterNationalSecurity } from '../../models/public-register-national-security.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { PUBLIC_REGISTER_WITHHOLD_REASON } from '../../constants/marine-licence.js'

const buildNationalSecurityUpdate = ({
  nationalSecurityApproval,
  reason,
  updatedAt,
  updatedBy
}) => {
  const $set = {
    'publicRegister.nationalSecurityApproval': nationalSecurityApproval,
    updatedAt,
    updatedBy
  }

  if (nationalSecurityApproval === 'yes') {
    return { $set: { ...$set, 'publicRegister.reason': reason } }
  }

  return { $set, $unset: { 'publicRegister.reason': '' } }
}

export const updatePublicRegisterNationalSecurityController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: publicRegisterNationalSecurity
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request
      const result = await db.collection(collectionMarineLicences).updateOne(
        {
          _id: ObjectId.createFromHexString(payload.id),
          'publicRegister.withholdReason':
            PUBLIC_REGISTER_WITHHOLD_REASON.NATIONAL_SECURITY
        },
        buildNationalSecurityUpdate(payload)
      )
      if (result.matchedCount === 0) {
        throw Boom.conflict(
          'Marine licence is not withholding information for national security reasons'
        )
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
      throw Boom.internal(
        `Error updating public register national security: ${error.message}`
      )
    }
  }
}
