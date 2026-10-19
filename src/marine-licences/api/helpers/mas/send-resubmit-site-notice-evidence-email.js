import { config } from '../../../../config.js'
import { sendEmail } from '../../../../shared/helpers/email.js'

export const sendResubmitSiteNoticeEvidenceEmail = async ({
  db,
  userName,
  userEmail,
  applicationReference,
  viewDetailsUrl
}) => {
  const { marineLicence } = config.get('notify')

  const result = await sendEmail({
    templateId: marineLicence.notifyResubmitSiteNoticeEvidenceId,
    userEmail,
    personalisation: {
      name: userName,
      applicationReference,
      viewDetailsUrl
    },
    applicationReference,
    projectType: 'marine-licence'
  })

  await db.collection('email-queue').insertOne({
    applicationReferenceNumber: applicationReference,
    ...result
  })
}
