import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import { collectionMarineLicences } from '../../../constants/db-collections.js'
import { MARINE_LICENCE_STATUS } from '../../../../../marine-licences/constants/marine-licence.js'
import { buildCoordinatesCsvUrlById } from '../../../../../marine-licences/constants/coordinates-csv.js'
import { buildWaterFrameworkDirectiveDynamicsPayload } from '../../../../../marine-licences/constants/water-framework-directive.js'
import { toUrlSafeApplicationReference } from '../../../../../marine-licences/api/helpers/url-transform.js'
import {
  logDynamicsSuccess,
  validateDynamicsResponse
} from '../dynamics-response.js'

/**
 * Fetches a marine licence from the database by application reference
 * @param {Object} db - Database connection
 * @param {string} applicationReferenceNumber - Application reference number
 * @returns {Promise<Object>} The marine licence document
 */
const fetchMarineLicence = async (db, applicationReferenceNumber) => {
  const marineLicence = await db
    .collection(collectionMarineLicences)
    .findOne({ applicationReference: applicationReferenceNumber })

  if (!marineLicence) {
    throw Boom.notFound(
      `Marine licence not found for applicationReference: ${applicationReferenceNumber}`
    )
  }

  return marineLicence
}

export const sendMarineLicenceToDynamics = async (
  server,
  accessToken,
  queueItem
) => {
  const {
    marineLicences: { apiUrl, httpTimeoutMs }
  } = config.get('dynamics')

  const { applicationReferenceNumber } = queueItem

  const frontEndBaseUrl = config.get('frontEndBaseUrl')
  const backendGatewayUrl = config.get('backendGatewayUrl')

  const marineLicence = await fetchMarineLicence(
    server.db,
    applicationReferenceNumber
  )

  const { feeEstimate = {} } = marineLicence

  const feeBand = feeEstimate.feeBand ?? '2A'

  const payload = {
    contactid: marineLicence.contactId,
    marineLicenceId: marineLicence._id.toString(),
    projectName: marineLicence.projectName,
    projectBackground: marineLicence.projectBackground ?? null,
    reference: applicationReferenceNumber,
    feeBand,
    applicationUrl: `${frontEndBaseUrl}/marine-licence/redaction/${toUrlSafeApplicationReference(applicationReferenceNumber)}`,
    coordinatesCsvUrl: buildCoordinatesCsvUrlById(
      backendGatewayUrl,
      marineLicence._id
    ),
    waterFrameworkDirective: buildWaterFrameworkDirectiveDynamicsPayload(
      marineLicence.waterFrameworkDirective,
      backendGatewayUrl,
      marineLicence._id
    ),
    marinePlanAreas: marineLicence.marinePlanAreas ?? [],
    coastalOperationsAreas: marineLicence.coastalOperationsAreas ?? [],
    publicRegister: {
      withholdConsent: marineLicence.publicRegister?.withholdConsent ?? null,
      reason: marineLicence.publicRegister?.reason ?? null
    },
    ...(marineLicence.organisation?.id
      ? { applicantOrganisationId: marineLicence.organisation.id }
      : {}),
    status: MARINE_LICENCE_STATUS.SUBMITTED
  }

  const response = await Wreck.post(apiUrl, {
    payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    timeout: httpTimeoutMs
  })

  const statusCode = response.res?.statusCode
  validateDynamicsResponse(
    statusCode,
    applicationReferenceNumber,
    'send-marine-licence'
  )
  logDynamicsSuccess(
    statusCode,
    applicationReferenceNumber,
    'send-marine-licence',
    'Successfully sent Marine Licence to Dynamics 365'
  )

  return response.payload
}
