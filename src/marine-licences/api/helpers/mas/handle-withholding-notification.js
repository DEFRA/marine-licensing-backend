import { config } from '../../../../config.js'
import {
  APPLICATION_TASK_TYPE,
  MAS_EVENT_ACTION
} from '../../../constants/marine-licence.js'
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

  const commercialConfidentialityDecision = buildBasis(
    commercialConfidentiality
  )
  if (commercialConfidentialityDecision) {
    data.commercialConfidentiality = commercialConfidentialityDecision
  }

  return data
}

export const handleWithholdingNotification = async (
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

  const data = buildWithholdingData({
    nationalSecurity,
    commercialConfidentiality
  })

  // With no basis the applicant's page would render empty, so there is nothing to
  // ask them to acknowledge.
  if (!Object.keys(data).length) {
    logger.warn(
      {
        event: {
          action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
          outcome: 'failure',
          reference: applicationReference,
          reason: 'no withholding basis on message'
        }
      },
      `Discarding withholding notification for applicationReference ${applicationReference}: neither national security nor commercial confidentiality basis was present`
    )
    return null
  }

  const result = await addApplicationTask(db, logger, {
    applicationReference,
    type: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
    data,
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
