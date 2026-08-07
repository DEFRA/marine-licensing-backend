import { config } from '../../config.js'
import { isOrganisationEmployee } from '../common/helpers/organisations.js'
import { sendEmail } from './email.js'

const getNotifyTemplateId = (organisation, projectType) => {
  const { exemption, marineLicence } = config.get('notify')
  const notifyConfig =
    projectType === 'marine-licence' ? marineLicence : exemption

  if (isOrganisationEmployee(organisation)) {
    return notifyConfig.notifyTemplateIdEmployee
  }
  if (organisation?.userRelationshipType === 'Agent') {
    return notifyConfig.notifyTemplateIdAgent
  }
  return notifyConfig.notifyTemplateId
}

export const sendEmailConfirmation = async ({
  db,
  userName,
  userEmail,
  organisation,
  applicationReference,
  viewDetailsUrl,
  projectType
}) => {
  const result = await sendEmail({
    templateId: getNotifyTemplateId(organisation, projectType),
    userEmail,
    personalisation: {
      name: userName,
      reference: applicationReference,
      viewDetailsUrl,
      organisationName: organisation?.name
    },
    applicationReference,
    projectType
  })
  db.collection('email-queue')?.insertOne({
    applicationReferenceNumber: applicationReference,
    ...result
  })
}
