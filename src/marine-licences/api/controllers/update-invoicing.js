import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { invoicingSchema } from '../../models/invoicing/invoicing.js'

export const updateInvoicingController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      query: false,
      payload: invoicingSchema
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db } = request

      const {
        id,
        invoiceAddressType,
        invoiceAddress,
        invoiceContactDetails,
        updatedAt,
        updatedBy
      } = payload

      const result = await db.collection(collectionMarineLicences).updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            invoicing: {
              invoiceAddressType,
              invoiceAddress,
              invoiceContactDetails
            },
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
      throw Boom.internal(`Error updating invoicing: ${error.message}`)
    }
  }
}
