import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { copyMarineLicence } from '../../models/copy-marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { addCreateAuditFields } from '../../../shared/common/helpers/mongo-audit.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { buildCopiedMarineLicence } from '../helpers/build-copied-marine-licence.js'

export const copyMarineLicenceController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: copyMarineLicence
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, auth } = request
      const { id } = payload

      const source = await db
        .collection(collectionMarineLicences)
        .findOne({ _id: ObjectId.createFromHexString(id) })

      if (source.status !== MARINE_LICENCE_STATUS.REJECTED) {
        throw Boom.badRequest(
          `Cannot copy marine licence as marine licence must be the status '${MARINE_LICENCE_STATUS.REJECTED}'.`
        )
      }

      const copied = buildCopiedMarineLicence(source, {
        contactId: getContactId(auth),
        ...addCreateAuditFields(auth)
      })

      const result = await db
        .collection(collectionMarineLicences)
        .insertOne(copied)

      return h
        .response({
          message: 'success',
          value: { id: result.insertedId.toString() }
        })
        .code(StatusCodes.CREATED)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error copying marine licence: ${error.message}`)
    }
  }
}
