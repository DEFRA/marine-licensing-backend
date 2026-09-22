import { config } from '../../../../config.js'
import {
  APPLICATION_TASK_TYPE,
  MAS_EVENT_ACTION,
  WITHHOLDING_DECISION,
  WITHHOLDING_REQUEST_RELATES_TO
} from '../../../constants/marine-licence.js'
import { addApplicationTask } from './add-application-task.js'
import { sendWithholdingNotificationEmail } from './send-withholding-notification-email.js'

const BASES_BY_REQUEST = {
  [WITHHOLDING_REQUEST_RELATES_TO.BOTH]: [
    'nationalSecurity',
    'commercialConfidentiality'
  ],
  [WITHHOLDING_REQUEST_RELATES_TO.NATIONAL_SECURITY]: ['nationalSecurity'],
  [WITHHOLDING_REQUEST_RELATES_TO.COMMERCIAL]: ['commercialConfidentiality']
}

// The message names commercial confidentiality without the second word; the stored key
// keeps it, because that is what the applicant's page renders its heading from.
const MESSAGE_FIELDS = {
  nationalSecurity: {
    decision: 'nationalSecurityDecision',
    applicantMessage: 'nationalSecurityApplicantMessage'
  },
  commercialConfidentiality: {
    decision: 'commercialDecision',
    applicantMessage: 'commercialApplicantMessage'
  }
}

const buildBasis = (body, basis) => {
  const { decision, applicantMessage } = MESSAGE_FIELDS[basis]

  if (!Object.values(WITHHOLDING_DECISION).includes(body[decision])) {
    return null
  }

  return {
    decision: body[decision],
    applicantMessage: body[applicantMessage] ?? ''
  }
}

// requestRelatesTo is what decides which bases the applicant sees; a basis it does not
// name is absent from the page entirely, even if the message carries a decision for it.
const buildWithholdingData = (body) => {
  const data = {}

  for (const basis of BASES_BY_REQUEST[body.requestRelatesTo] ?? []) {
    const built = buildBasis(body, basis)

    if (built) {
      data[basis] = built
    }
  }

  return Object.keys(data).length
    ? { decisionDate: body.decisionDate, ...data }
    : null
}

const logDiscarded = (logger, applicationReference, reason) =>
  logger.warn(
    {
      event: {
        action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
        outcome: 'failure',
        reference: applicationReference,
        reason
      }
    },
    `Discarding withholding notification for applicationReference ${applicationReference}: ${reason}`
  )

export const handleWithholdingNotification = async (
  db,
  logger,
  { body, id }
) => {
  const { applicationReference, userName, userEmail } = body
  const frontEndBaseUrl = config.get('frontEndBaseUrl')

  const data = buildWithholdingData(body)

  // With no basis the applicant's page would render empty, so there is nothing to
  // ask them to acknowledge.
  if (!data) {
    logDiscarded(
      logger,
      applicationReference,
      `no decision to show for requestRelatesTo '${body.requestRelatesTo}'`
    )
    return null
  }

  const result = await addApplicationTask(db, logger, {
    applicationReference,
    type: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
    data,
    updatedBy: id
  })

  if (!result) {
    return null
  }

  // The task is what the applicant acts on, so a message with no recipient still
  // raises it rather than failing.
  if (!userEmail) {
    logger.warn(
      {
        event: {
          action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
          outcome: 'failure',
          reference: applicationReference,
          reason: 'no recipient on message'
        }
      },
      `Raised the withholding notification task for applicationReference ${applicationReference} but sent no email: the message carried no userEmail`
    )
    return result
  }

  await sendWithholdingNotificationEmail({
    db,
    userName,
    userEmail,
    applicationReference,
    viewDetailsUrl: `${frontEndBaseUrl}/marine-licence/view-details/${result.marineLicence._id}`
  })

  return result
}
