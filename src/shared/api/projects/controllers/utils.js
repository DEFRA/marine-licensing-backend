import {
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'
import { batchGetContactNames } from '../../../common/helpers/dynamics/get-contact-details.js'

const logger = createLogger()
const logSystem = 'Projects:GetProjects'

export const getUserFilter = (show, contactId, user) => {
  if (show === 'specific-user') {
    return user?.length ? { contactId: { $in: user } } : {}
  }

  return { contactId }
}

export const getStatusFilter = (status) => {
  if (!status) {
    return {}
  }

  return {
    status: {
      $in: status
    }
  }
}

export const getOrganisationContactIds = async (db, organisationId) => {
  const orgFilter = { 'organisation.id': organisationId }
  const dbStartedAt = Date.now()

  const [exemptionContactIds, marineLicenceContactIds] = await Promise.all([
    db.collection(collectionExemptions).distinct('contactId', orgFilter),
    db.collection(collectionMarineLicences).distinct('contactId', orgFilter)
  ])

  logger.info(
    `${logSystem}: Organisation contactId query completed in ${Date.now() - dbStartedAt}ms`
  )

  return [
    ...new Set(
      [...exemptionContactIds, ...marineLicenceContactIds].filter(Boolean)
    )
  ]
}

export const getOrganisationUserNames = async (db, organisationId) => {
  const contactIds = await getOrganisationContactIds(db, organisationId)
  return batchGetContactNames(contactIds)
}

export const queryEmployeeCollections = async (db, orgFilter, type) => {
  const requestingExemptions = !type || type.includes('exemption')
  const requestingMarineLicences = !type || type.includes('marine-licence')

  const dbStartedAt = Date.now()

  const [empExemptions, empMarineLicences] = await Promise.all([
    requestingExemptions
      ? db
          .collection(collectionExemptions)
          .find(orgFilter)
          .sort({ projectName: 1 })
          .toArray()
      : Promise.resolve([]),
    requestingMarineLicences
      ? db
          .collection(collectionMarineLicences)
          .find(orgFilter)
          .sort({ projectName: 1 })
          .toArray()
      : Promise.resolve([])
  ])

  logger.info(
    `${logSystem}: Employee projects database query completed in ${Date.now() - dbStartedAt}ms (exemptions: ${empExemptions.length}, marineLicences: ${empMarineLicences.length})`
  )

  return [empExemptions, empMarineLicences]
}
