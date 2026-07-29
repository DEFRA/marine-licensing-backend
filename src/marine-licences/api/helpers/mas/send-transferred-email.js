import { config } from '../../../../config.js'
import { sendEmail } from '../../../../shared/helpers/email.js'

export const sendTransferredEmail = async ({
  db,
  userName,
  userEmail,
  applicationReference,
  viewDetailsUrl
}) => {
  const { marineLicence } = config.get('notify')

  const result = await sendEmail({
    templateId: marineLicence.notifyTransferredId,
    userEmail,
    personalisation: {
      name: userName,
      applicationReference,
      viewDetailsUrl
    },
    reference: applicationReference,
    projectType: 'marine-licence'
  })

  db.collection('email-queue')?.insertOne({
    applicationReferenceNumber: applicationReference,
    ...result
  })
}
