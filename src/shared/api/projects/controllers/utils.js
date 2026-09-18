import {
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'
import { batchGetContactNames } from '../../../common/helpers/dynamics/get-contact-details.js'
import { ACTION_REQUIRED_STATUS_FILTER } from '../../../constants/project-status.js'
import {
  noOutstandingTasksQuery,
  outstandingTasksQuery
} from '../../../helpers/application-tasks.js'

const logger = createLogger()
const logSystem = 'Projects:GetProjects'

export const getUserFilter = (show, contactId, user) => {
  if (show === 'specific-user') {
    return user?.length ? { contactId: { $in: user } } : {}
  }

  return { contactId }
}

// "Action required" is derived, not stored, so it cannot be matched by the stored
// status alone: a selection of it becomes a task predicate, and every other
// selection must exclude projects that display as "Action required" instead.
export const getStatusFilter = (status) => {
  if (!status?.length) {
    return {}
  }

  const storedStatuses = status.filter(
    (value) => value !== ACTION_REQUIRED_STATUS_FILTER
  )
  const includesActionRequired = storedStatuses.length !== status.length

  const storedQuery = {
    status: { $in: storedStatuses },
    ...noOutstandingTasksQuery
  }

  if (!includesActionRequired) {
    return storedQuery
  }

  if (!storedStatuses.length) {
    return outstandingTasksQuery
  }

  return { $or: [storedQuery, outstandingTasksQuery] }
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
