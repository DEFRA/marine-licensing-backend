import { StatusCodes } from 'http-status-codes'
import { getContactId } from '../../helpers/get-contact-id.js'
import { EXEMPTION_STATUS_LABEL } from '../../../common/constants/exemption.js'
import { getOrganisationDetailsFromAuthToken } from '../helpers/get-organisation-from-token.js'
import { batchGetContactNames } from '../../../common/helpers/dynamics/get-contact-details.js'

const transformExemptionBase = (exemption) => {
  const { _id, projectName, applicationReference, status, submittedAt } =
    exemption

  return {
    id: _id.toString(),
    ...(status && { status: EXEMPTION_STATUS_LABEL[status] || status }),
    ...(projectName && { projectName }),
    ...(applicationReference && { applicationReference }),
    ...(submittedAt && { submittedAt })
  }
}

const transformExemption = (exemption, currentContactId, ownerNames = {}) => {
  const { contactId } = exemption

  return {
    ...transformExemptionBase(exemption),
    contactId,
    isOwnProject: contactId === currentContactId,
    ownerName: ownerNames[contactId] || '-'
  }
}

const transformedExemptions = (exemptions) =>
  exemptions.map(transformExemptionBase)

export const sortByStatus = (a, b) => {
  const statusOrder = [
    EXEMPTION_STATUS_LABEL.DRAFT,
    EXEMPTION_STATUS_LABEL.ACTIVE
  ]

  const firstExemptionStatus = statusOrder.indexOf(a.status)
  const comparisonExemptionStatus = statusOrder.indexOf(b.status)

  // Handle a scenario where a status is not in the array
  const unknownStatusIndex = statusOrder.length

  const aSortIndex =
    firstExemptionStatus === -1 ? unknownStatusIndex : firstExemptionStatus

  const bSortIndex =
    comparisonExemptionStatus === -1
      ? unknownStatusIndex
      : comparisonExemptionStatus

  return aSortIndex - bSortIndex
}

export const getExemptionsController = {
  handler: async (request, h) => {
    const { db, auth } = request
    const contactId = getContactId(auth)
    const { organisationId, userRelationshipType } =
      getOrganisationDetailsFromAuthToken(auth)

    const isEmployee = userRelationshipType === 'Employee'

    if (isEmployee && organisationId) {
      const empExemptions = await db
        .collection('exemptions')
        .find({ 'organisation.id': organisationId })
        .sort({ projectName: 1 })
        .toArray()

      const contactIds = [
        ...new Set(empExemptions.map((e) => e.contactId).filter(Boolean))
      ]
      const ownerNames = await batchGetContactNames(contactIds)

      const employeeTransformed = empExemptions
        .map((e) => transformExemption(e, contactId, ownerNames))
        .sort(sortByStatus)

      return h
        .response({
          message: 'success',
          value: employeeTransformed,
          isEmployee: true,
          organisationId
        })
        .code(StatusCodes.OK)
    }

    const exemptions = await db
      .collection('exemptions')
      .find({
        contactId,
        ...(organisationId
          ? { 'organisation.id': organisationId }
          : { 'organisation.id': { $exists: false } })
      })
      .sort({ projectName: 1 })
      .toArray()

    // The second sort here is relying on stable sort to achieve a final sort
    // by status and then subsorted by project name if the status is the same.
    const transformed = transformedExemptions(exemptions).sort(sortByStatus)

    return h
      .response({
        message: 'success',
        value: transformed,
        isEmployee: false
      })
      .code(StatusCodes.OK)
  }
}
