import { config } from '../../../../config.js'
import { APPLICATION_TASK_TYPE } from '../../../constants/marine-licence.js'
import { addApplicationTask } from './add-application-task.js'
import { sendWithholdingNotificationEmail } from './send-withholding-notification-email.js'

// A basis is present on the message only when the caseworker flagged redaction on
// that basis, and absence is what hides the section on the applicant's page.
const buildBasis = (basis) => {
  if (!basis) {
    return undefined
  }

  return {
    withheldSome: basis.withheldSome === true,
    comments: basis.comments ?? ''
  }
}

const buildWithholdingData = ({
  nationalSecurity,
  commercialConfidentiality
}) => {
  const data = {}

  const nationalSecurityDecision = buildBasis(nationalSecurity)
  if (nationalSecurityDecision) {
    data.nationalSecurity = nationalSecurityDecision
  }

  const commercialDecision = buildBasis(commercialConfidentiality)
  if (commercialDecision) {
    data.commercialConfidentiality = commercialDecision
  }

  return data
}

export const updateWithholdingNotification = async (
  db,
  logger,
  { body, id }
) => {
  const {
    applicationReference,
    nationalSecurity,
    commercialConfidentiality,
    userName,
    userEmail
  } = body
  const frontEndBaseUrl = config.get('frontEndBaseUrl')

  const result = await addApplicationTask(db, logger, {
    applicationReference,
    type: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
    data: buildWithholdingData({ nationalSecurity, commercialConfidentiality }),
    updatedBy: id
  })

  if (result) {
    await sendWithholdingNotificationEmail({
      db,
      userName,
      userEmail,
      applicationReference,
      viewDetailsUrl: `${frontEndBaseUrl}/marine-licence/view-details/${result.marineLicence._id}`
    })
  }

  return result
}
