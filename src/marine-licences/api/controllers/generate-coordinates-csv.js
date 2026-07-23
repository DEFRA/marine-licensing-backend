import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'
import { isEntraIdUser } from '../../../shared/helpers/is-entra-id-user.js'
import Boom from '@hapi/boom'
import {
  buildCoordinatesCsvStream,
  coordinatesCsvResponse
} from '../csv/build-coordinates-csv-stream.js'

export const generateCoordinatesCsvController = {
  handler: async (request, h) => {
    const isUserEntraIdUser = isEntraIdUser(request)

    if (!isUserEntraIdUser) {
      throw Boom.forbidden('Not authorised to view CSV data')
    }

    const { params, db } = request

    const doc = await db
      .collection(collectionMarineLicences)
      .findOne(
        { _id: ObjectId.createFromHexString(params.id) },
        { projection: { siteDetails: 1 } }
      )

    if (!doc) {
      throw Boom.notFound('Marine licence not found')
    }

    return coordinatesCsvResponse(h, buildCoordinatesCsvStream(doc.siteDetails))
  }
}
