import Boom from '@hapi/boom'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { generateCoordinatesCsvByReferenceParams } from '../../models/generate-coordinates-csv-by-reference.js'
import {
  buildCoordinatesCsvStream,
  coordinatesCsvResponse
} from '../csv/build-coordinates-csv-stream.js'

export const generateCoordinatesCsvByReferenceController = {
  options: {
    auth: false,
    validate: {
      params: generateCoordinatesCsvByReferenceParams
    }
  },
  handler: async (request, h) => {
    const { applicationReference } = request.params

    const doc = await request.db
      .collection(collectionMarineLicences)
      .findOne(
        { applicationReference },
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
