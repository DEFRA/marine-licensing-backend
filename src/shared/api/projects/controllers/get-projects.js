import { StatusCodes } from 'http-status-codes'
import {
  collectionExemptions,
  collectionMarineLicenses
} from '../../../common/constants/db-collections.js'
import { getContactId } from '../../../helpers/get-contact-id.js'
import {
  PROJECT_STATUS_LABEL,
  PROJECT_TYPES
} from '../../../constants/project-status.js'
import { getOrganisationDetailsFromAuthToken } from '../../../helpers/get-organisation-from-token.js'
import { batchGetContactNames } from '../../../common/helpers/dynamics/get-contact-details.js'

const transformProjectBase = (project) => {
  const { _id, projectName, applicationReference, status, submittedAt } =
    project

  return {
    id: _id.toString(),
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
    ...transformProjectBase(project),
    projectType,
    contactId,
    test: 'test',
    isOwnProject: contactId === currentContactId,
    ownerName: ownerNames[contactId] || '-'
  }
}

const transformProjects = (projects, type) =>
  projects.map((p) => transformProject(p, type))

export const sortByStatus = (a, b) => {
  const statusOrder = [PROJECT_STATUS_LABEL.DRAFT, PROJECT_STATUS_LABEL.ACTIVE]

  const firstStatus = statusOrder.indexOf(a.status)
  const comparisonStatus = statusOrder.indexOf(b.status)

  const unknownStatusIndex = statusOrder.length

  const aSortIndex = firstStatus === -1 ? unknownStatusIndex : firstStatus
  const bSortIndex =
    comparisonStatus === -1 ? unknownStatusIndex : comparisonStatus

  return aSortIndex - bSortIndex
}

export const getProjectsController = {
  handler: async (request, h) => {
    const { db, auth } = request
    const contactId = getContactId(auth)
    const { organisationId, userRelationshipType } =
      getOrganisationDetailsFromAuthToken(auth)

    const isEmployee = userRelationshipType === 'Employee'

    if (isEmployee && organisationId) {
      const orgFilter = { 'organisation.id': organisationId }

      const [empExemptions, empMarineLicenses] = await Promise.all([
        db
          .collection(collectionExemptions)
          .find(orgFilter)
          .sort({ projectName: 1 })
          .toArray(),
        db
          .collection(collectionMarineLicenses)
          .find(orgFilter)
          .sort({ projectName: 1 })
          .toArray()
      ])

      const contactIds = [
        ...new Set(
          [...empExemptions, ...empMarineLicenses]
            .map((e) => e.contactId)
            .filter(Boolean)
        )
      ]
      const ownerNames = await batchGetContactNames(contactIds)

      const employeeTransformed = [
        ...empExemptions.map((e) =>
          transformProject(e, PROJECT_TYPES.EXEMPTION, contactId, ownerNames)
        ),
        ...empMarineLicenses.map((m) =>
          transformProject(
            m,
            PROJECT_TYPES.MARINE_LICENCE,
            contactId,
            ownerNames
          )
        )
      ].sort(sortByStatus)

      return h
        .response({
          message: 'success',
          value: employeeTransformed,
          isEmployee: true,
          organisationId
        })
        .code(StatusCodes.OK)
    }

    const citizenFilter = {
      contactId,
      ...(organisationId
        ? { 'organisation.id': organisationId }
        : { 'organisation.id': { $exists: false } })
    }

    const [exemptions, marineLicenses] = await Promise.allSettled([
      db
        .collection(collectionExemptions)
        .find(citizenFilter)
        .sort({ projectName: 1 })
        .toArray(),
      db
        .collection(collectionMarineLicenses)
        .find(citizenFilter)
        .sort({ projectName: 1 })
        .toArray()
    ]).then((responses) => {
      return responses.map((response) =>
        response.status === 'fulfilled' ? response.value : null
      )
    })

    const transformed = [
      ...transformProjects(exemptions, PROJECT_TYPES.EXEMPTION),
      ...transformProjects(marineLicenses, PROJECT_TYPES.MARINE_LICENCE)
    ].sort(sortByStatus)

    return h
      .response({
        message: 'success',
        value: transformed,
        isEmployee: false
      })
      .code(StatusCodes.OK)
  }
}
