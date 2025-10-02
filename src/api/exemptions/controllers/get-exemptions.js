import { StatusCodes } from 'http-status-codes'
import { getContactId } from '../helpers/get-contact-id.js'
import { EXEMPTION_STATUS_LABEL } from '../../../common/constants/exemption.js'
import { getApplicantOrganisationId } from '../helpers/get-applicant-organisation.js'

const transformedExemptions = (exemptions) =>
  exemptions.map((exemption) => {
    const { _id, projectName, applicationReference, status, submittedAt } =
      exemption

    return {
      id: _id.toString(),
      ...(status && { status: EXEMPTION_STATUS_LABEL[status] || status }),
      ...(projectName && { projectName }),
      ...(applicationReference && { applicationReference }),
      ...(submittedAt && { submittedAt })
    }
  })

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
    const applicantOrganisationId = getApplicantOrganisationId(auth)

    const exemptions = await db
      .collection('exemptions')
      .find({
        contactId,
        'organisations.applicant.id': applicantOrganisationId
      })
      .sort({ projectName: 1 })
      .toArray()

    const transformed = transformedExemptions(exemptions).sort(sortByStatus)

    return h
      .response({
        message: 'success',
        value: transformed
      })
      .code(StatusCodes.OK)
  }
}
