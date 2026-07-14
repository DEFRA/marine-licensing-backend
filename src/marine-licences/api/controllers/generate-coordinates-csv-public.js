import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import {
  buildCoordinatesCsvStream,
  coordinatesCsvResponse
} from '../csv/build-coordinates-csv-stream.js'

export const generateCoordinatesCsvPublicController = {
  options: {
    auth: false,
    validate: {
      params: getMarineLicence
    }
  },
  handler: async (request, h) => {
    const { id } = request.params

    const doc = await request.db
      .collection(collectionMarineLicences)
      .findOne(
        { _id: ObjectId.createFromHexString(id) },
        { projection: { siteDetails: 1, status: 1 } }
      )

    if (!doc) {
      throw Boom.notFound('Marine licence not found')
    }

    if (doc.status === MARINE_LICENCE_STATUS.DRAFT) {
      throw Boom.forbidden(notAuthorisedMessage)
    }

    return coordinatesCsvResponse(h, buildCoordinatesCsvStream(doc.siteDetails))
  }
}
