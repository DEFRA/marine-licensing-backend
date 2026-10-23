import { config } from '../../../../config.js'
import { sendEmail } from '../../../../shared/helpers/email.js'

const createApplicationTaskEmailSender =
  (templateKey) =>
  async ({ db, userName, userEmail, applicationReference, viewDetailsUrl }) => {
    const { marineLicence } = config.get('notify')

    const result = await sendEmail({
      templateId: marineLicence[templateKey],
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

export const sendWithholdingNotificationEmail =
  createApplicationTaskEmailSender('notifyWithholdingNotificationId')

export const sendResubmitSiteNoticeEvidenceEmail =
  createApplicationTaskEmailSender('notifyResubmitSiteNoticeEvidenceId')

export const sendPublicNoticeEmail = createApplicationTaskEmailSender(
  'notifyPublicNoticeId'
)
