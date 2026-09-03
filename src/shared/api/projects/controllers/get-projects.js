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
import { getProjects } from '../models/get-projects.js'
import {
  getOrganisationUserNames,
  getStatusFilter,
  getUserFilter,
  queryEmployeeCollections
} from './utils.js'

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

const transformProject = (project, projectType, currentContactId) => {
  const { contactId } = project

  return {
    ...transformProjectBase(project, projectType),
    contactId,
    isOwnProject: contactId === currentContactId
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
  const { show, status, type, user } = payload

  const orgFilter = {
    'organisation.id': organisationId,
    ...(show === 'all-projects' ? {} : getUserFilter(show, contactId, user)),
    ...(status && getStatusFilter(status))
  }

  const [empExemptions, empMarineLicences] = await queryEmployeeCollections(
    db,
    orgFilter,
    type
  )

  return [
    ...empExemptions.map((e) =>
      transformProject(e, PROJECT_TYPES.EXEMPTION, contactId)
    ),
    ...empMarineLicences.map((m) =>
      transformProject(m, PROJECT_TYPES.MARINE_LICENCE, contactId)
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
      const [projects, users] = await Promise.all([
        getEmployeeProjects(db, organisationId, contactId, payload),
        !payload?.skipUsers
          ? Promise.resolve({})
          : getOrganisationUserNames(db, organisationId)
      ])

      return h
        .response({
          message: 'success',
          value: { projects, users },
          isEmployee: true,
          organisationId
        })
        .code(StatusCodes.OK)
    }

    const projects = await getCitizenProjects(db, contactId, organisationId)
    return h
      .response({
        message: 'success',
        value: { projects, users: {} },
        isEmployee: false
      })
      .code(StatusCodes.OK)
  }
}
