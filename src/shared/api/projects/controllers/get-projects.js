import { StatusCodes } from 'http-status-codes'
import {
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'
import { getContactId } from '../../../helpers/get-contact-id.js'
import {
  PROJECT_STATUS_LABEL,
  PROJECT_TYPES
} from '../../../constants/project-status.js'
import { getOrganisationDetailsFromAuthToken } from '../../../helpers/get-organisation-from-token.js'
import { batchGetContactNames } from '../../../common/helpers/dynamics/get-contact-details.js'
import { getProjects } from '../models/get-projects.js'
import { getStatusFilter, queryEmployeeCollections } from './utils.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()
const logSystem = 'Projects:GetProjects'

const transformProjectBase = (project, projectType) => {
  const { _id, projectName, applicationReference, status, submittedAt } =
    project

  return {
    id: _id.toString(),
    projectType,
    ...(status && { status: PROJECT_STATUS_LABEL[status] || status }),
    ...(projectName && { projectName }),
    ...(applicationReference && { applicationReference }),
    ...(submittedAt && { submittedAt })
  }
}

const transformProject = (
  project,
  projectType,
  currentContactId,
  ownerNames = {}
) => {
  const { contactId } = project

  return {
    ...transformProjectBase(project, projectType),
    contactId,
    isOwnProject: contactId === currentContactId,
    ownerName: ownerNames[contactId] || '-'
  }
}

const transformProjects = (projects, type) =>
  (projects ?? []).filter(Boolean).map((p) => transformProjectBase(p, type))

export const sortByStatus = (a, b) => {
  const statusOrder = [
    PROJECT_STATUS_LABEL.TRANSFERRED,
    PROJECT_STATUS_LABEL.DRAFT,
    PROJECT_STATUS_LABEL.ACTIVE
  ]

  const firstStatus = statusOrder.indexOf(a.status)
  const comparisonStatus = statusOrder.indexOf(b.status)

  const unknownStatusIndex = statusOrder.length

  const aSortIndex = firstStatus === -1 ? unknownStatusIndex : firstStatus
  const bSortIndex =
    comparisonStatus === -1 ? unknownStatusIndex : comparisonStatus

  return aSortIndex - bSortIndex
}

const getEmployeeProjects = async (
  db,
  organisationId,
  contactId,
  payload = {}
) => {
  const { show, status, type } = payload

  const orgFilter = {
    'organisation.id': organisationId,
    ...(show === 'all-projects' ? {} : { contactId }),
    ...(status && getStatusFilter(status))
  }

  const [empExemptions, empMarineLicences] = await queryEmployeeCollections(
    db,
    orgFilter,
    type
  )

  const contactIds = [
    ...new Set(
      [...empExemptions, ...empMarineLicences]
        .map((e) => e.contactId)
        .filter(Boolean)
    )
  ]
  const ownerNames = await batchGetContactNames(contactIds)

  return [
    ...empExemptions.map((e) =>
      transformProject(e, PROJECT_TYPES.EXEMPTION, contactId, ownerNames)
    ),
    ...empMarineLicences.map((m) =>
      transformProject(m, PROJECT_TYPES.MARINE_LICENCE, contactId, ownerNames)
    )
  ].sort(sortByStatus)
}

const getCitizenProjects = async (db, contactId, organisationId) => {
  const citizenFilter = {
    contactId,
    ...(organisationId
      ? { 'organisation.id': organisationId }
      : { 'organisation.id': { $exists: false } })
  }

  const [exemptions, marineLicences] = await Promise.allSettled([
    db
      .collection(collectionExemptions)
      .find(citizenFilter)
      .sort({ projectName: 1 })
      .toArray(),
    db
      .collection(collectionMarineLicences)
      .find(citizenFilter)
      .sort({ projectName: 1 })
      .toArray()
  ]).then((responses) =>
    responses.map((response) =>
      response.status === 'fulfilled' ? response.value : null
    )
  )

  return [
    ...transformProjects(exemptions, PROJECT_TYPES.EXEMPTION),
    ...transformProjects(marineLicences, PROJECT_TYPES.MARINE_LICENCE)
  ].sort(sortByStatus)
}

export const getProjectsController = {
  options: {
    validate: {
      payload: getProjects
    }
  },
  handler: async (request, h) => {
    const { db, auth, payload } = request
    const contactId = getContactId(auth)
    const { organisationId, userRelationshipType } =
      getOrganisationDetailsFromAuthToken(auth)

    const isEmployee = userRelationshipType === 'Employee'

    if (isEmployee && organisationId) {
      const employeeProjects = await getEmployeeProjects(
        db,
        organisationId,
        contactId,
        payload
      )

      return h
        .response({
          message: 'success',
          value: employeeProjects,
          isEmployee: true,
          organisationId
        })
        .code(StatusCodes.OK)
    }

    const projects = await getCitizenProjects(db, contactId, organisationId)
    return h
      .response({ message: 'success', value: projects, isEmployee: false })
      .code(StatusCodes.OK)
  }
}
