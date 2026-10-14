import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { errorResponseSchema } from '../../../shared/models/error-response.js'
import { logResponseSchemaMismatch } from '../../../shared/common/helpers/log-response-schema-mismatch.js'
import {
  buildCoordinatesCsvStream,
  coordinatesCsvResponse
} from '../csv/build-coordinates-csv-stream.js'

export const generateCoordinatesCsvPublicController = {
  options: {
    auth: false,
    tags: ['api'],
    description: 'Download the site coordinates of a submitted marine licence',
    notes:
      'Returns a ZIP file named "Download CSV.zip". A single-site licence gives one CSV named after the site; a multi-site licence gives a combined CSV plus one CSV per site.',
    validate: {
      params: getMarineLicence
    },
    response: {
      status: {
        400: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema
      },
      failAction: logResponseSchemaMismatch
    },
    plugins: {
      'hapi-swagger': {
        produces: ['application/zip'],
        responses: {
          200: {
            description: 'A ZIP file of site coordinate CSVs',
            schema: { type: 'file' }
          },
          400: { description: 'The id is not a 24-character hex string' },
          403: { description: 'The marine licence is a draft' },
          404: { description: 'No marine licence has this id' },
          500: { description: 'Unexpected server error' }
        }
      }
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

    return coordinatesCsvResponse(
      h,
      buildCoordinatesCsvStream(doc.siteDetails),
      doc.siteDetails
    )
  }
}
