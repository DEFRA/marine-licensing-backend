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
import { formatMarinePlanPoliciesForGateway } from '../helpers/format-marine-plan-policies-for-gateway.js'
import { filterCurrentPolicyResponses } from '../helpers/marine-plan-policies/filter-current-policy-responses.js'
import { hydrateMarinePlanPolicies } from '../helpers/marine-plan-policies/hydrate-marine-plan-policies.js'

// Keeps the nullable pass-through fields below out of the handler's cyclomatic
// complexity, which the response body would otherwise breach as it grows.
const orNull = (value) => value ?? null

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
          marinePlanPolicies: 1,
          marinePlanPolicyResponses: 1,
          status: 1,
          withdrawnAt: 1
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
    await hydrateMarinePlanPolicies(request.db, doc)
    const { responses: marinePlanPolicyResponses } =
      filterCurrentPolicyResponses(
        doc.marinePlanPolicies,
        doc.marinePlanPolicyResponses
      )
    const marinePlanPolicies = formatMarinePlanPoliciesForGateway(
      doc.marinePlanPolicies,
      marinePlanPolicyResponses
    )

    return h
      .response({
        projectName: orNull(doc.projectName),
        projectBackground: orNull(doc.projectBackground),
        preferredLicenceDates: formatPreferredDates(doc.preferredDates),
        publicRegister: orNull(doc.publicRegister),
        specialLegalPowers: orNull(doc.specialLegalPowers),
        harbourAuthority: orNull(doc.harbourAuthority),
        otherAuthorities: orNull(doc.otherAuthorities),
        publicConsultation: orNull(doc.publicConsultation),
        waterFrameworkDirective: buildWaterFrameworkDirectiveDynamicsPayload(
          doc.waterFrameworkDirective,
          config.get('backendGatewayUrl'),
          id
        ),
        sites,
        marinePlanPolicies,
        withdrawnAt: orNull(doc.withdrawnAt)
      })
      .code(StatusCodes.OK)
  }
}
