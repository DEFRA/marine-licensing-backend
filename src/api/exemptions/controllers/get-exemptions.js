import { StatusCodes } from 'http-status-codes'
import { getContactId } from '../helpers/get-contact-id.js'
import {
  EXEMPTION_STATUS,
  EXEMPTION_TYPE
} from '../../../common/constants/exemption.js'

const transformedExemptions = (exemptions) =>
  exemptions.map((exemption) => {
    const {
      _id,
      projectName,
      applicationReference,
      type,
      status,
      submittedAt
    } = exemption

    return {
      id: _id.toString(),
      type: type ?? EXEMPTION_TYPE.EXEMPT_ACTIVITY,
      ...(status && { status }),
      ...(projectName && { projectName }),
      ...(applicationReference && { applicationReference }),
      ...(submittedAt && { submittedAt })
    }
  })

const sortByStatusAndProjectName = (exemptions) =>
  exemptions.sort((a, b) => {
    const statusOrder = [EXEMPTION_STATUS.DRAFT, EXEMPTION_STATUS.CLOSED]

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

    const statusesAreDifferent = aSortIndex !== bSortIndex
    if (statusesAreDifferent) {
      return aSortIndex - bSortIndex
    }

    return (a.projectName ?? '').localeCompare(b.projectName ?? '')
  })

export const getMyExemptionsController = {
  handler: async (request, h) => {
    const { db, auth } = request
    const contactId = getContactId(auth)

    const exemptions = await db
      .collection('exemptions')
      .find({ contactId })
      .toArray()

    const transformed = transformedExemptions(exemptions)
    const sorted = sortByStatusAndProjectName(transformed)

    return h
      .response({
        message: 'success',
        value: sorted
      })
      .code(StatusCodes.OK)
  }
}
