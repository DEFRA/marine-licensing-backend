import { config } from '../../../../config.js'
import { sendEmail } from '../../../../shared/helpers/email.js'

export const sendRejectedEmail = async ({
  db,
  userName,
  userEmail,
  applicationReference,
  viewDetailsUrl
}) => {
  const { marineLicence } = config.get('notify')

  const result = await sendEmail({
    templateId: marineLicence.notifyRejectedId,
    userEmail,
    personalisation: {
      name: userName,
      applicationReference,
      viewDetailsUrl
    },
    applicationReference,
    projectType: 'marine-licence'
  })

  db.collection('email-queue')?.insertOne({
    applicationReferenceNumber: applicationReference,
    ...result
  })
}
