import { StatusCodes } from 'http-status-codes'
import { getContactId } from '../helpers/get-contact-id.js'
import { EXEMPTION_TYPE } from '../../../common/constants/exemption.js'
import { authorizeOwnership } from '../helpers/authorize-ownership.js'

export const getMyExemptionsController = {
  options: {
    pre: [{ method: authorizeOwnership }]
  },
  handler: async (request, h) => {
    const { db, auth } = request
    const contactId = getContactId(auth)

    const exemptions = await db
      .collection('exemptions')
      .find({ contactId })
      .toArray()

    const transformedExemptions = exemptions.map((exemption) => {
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

    return h
      .response({ message: 'success', value: transformedExemptions })
      .code(StatusCodes.OK)
  }
}
