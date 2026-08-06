import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import { config } from '../../../config.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { buildWaterFrameworkDirectiveDynamicsPayload } from '../../constants/water-framework-directive.js'
import { getMarineLicence } from '../../models/get-marine-licence.js'
import { formatPreferredDates } from '../helpers/format-preferred-dates.js'
import { formatSitesForGateway } from '../helpers/format-sites-for-gateway.js'

export const getMarineLicenceGatewayController = {
  options: {
    auth: false,
    validate: {
      params: getMarineLicence
    }
  },
  handler: async (request, h) => {
    const { id } = request.params

    const doc = await request.db.collection(collectionMarineLicences).findOne(
      { _id: ObjectId.createFromHexString(id) },
      {
        projection: {
          projectName: 1,
          projectBackground: 1,
          preferredDates: 1,
          publicRegister: 1,
          specialLegalPowers: 1,
          harbourAuthority: 1,
          otherAuthorities: 1,
          publicConsultation: 1,
          waterFrameworkDirective: 1,
          siteDetails: 1,
          status: 1
        }
      }
    )

    if (!doc) {
      throw Boom.notFound('Marine licence not found')
    }

    if (doc.status === MARINE_LICENCE_STATUS.DRAFT) {
      throw Boom.forbidden(notAuthorisedMessage)
    }

    const sites = await formatSitesForGateway(doc.siteDetails)

    return h
      .response({
        projectName: doc.projectName ?? null,
        projectBackground: doc.projectBackground ?? null,
        preferredLicenceDates: formatPreferredDates(doc.preferredDates),
        publicRegister: doc.publicRegister ?? null,
        specialLegalPowers: doc.specialLegalPowers ?? null,
        harbourAuthority: doc.harbourAuthority ?? null,
        otherAuthorities: doc.otherAuthorities ?? null,
        publicConsultation: doc.publicConsultation ?? null,
        waterFrameworkDirective: buildWaterFrameworkDirectiveDynamicsPayload(
          doc.waterFrameworkDirective,
          config.get('backendGatewayUrl'),
          id
        ),
        sites
      })
      .code(StatusCodes.OK)
  }
}
