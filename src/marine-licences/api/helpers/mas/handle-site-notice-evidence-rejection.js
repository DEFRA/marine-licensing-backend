import { config } from '../../../../config.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import {
  APPLICATION_TASK_TYPE,
  MAS_EVENT_ACTION
} from '../../../constants/marine-licence.js'
import { siteNoticeEvidenceRejectionMessageSchema } from '../../../models/resubmit-site-notice-evidence.js'
import { addApplicationTask } from './add-application-task.js'
import { logNoRecipient } from './mas-logging.js'
import { sendResubmitSiteNoticeEvidenceEmail } from './send-resubmit-site-notice-evidence-email.js'

// Throwing leaves the message on the queue, so after its retries it is dead-lettered
// rather than lost.
const rejectUnprocessable = (logger, applicationReference, reason) => {
  logger.error(
    {
      event: {
        action: MAS_EVENT_ACTION.MESSAGE_UNPROCESSABLE,
        outcome: 'failure',
        reference: applicationReference,
        reason
      }
    },
    `Cannot process site notice evidence rejection for applicationReference ${applicationReference}: ${reason}`
  )
  throw new Error(`Unprocessable site notice evidence rejection: ${reason}`)
}

const findUnprocessableReason = (marineLicence, rejectedLocations) => {
  const siteNoticeTask = (marineLicence.applicationTasks ?? []).find(
    (task) => task.type === APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE
  )

  if (!siteNoticeTask?.resolvedAt) {
    return 'the applicant has not sent any site notice evidence'
  }

  const locationCount = marineLicence.siteNoticeEvidence?.length ?? 0
  const unknown = rejectedLocations
    .map(({ locationNumber }) => locationNumber)
    .filter((locationNumber) => locationNumber > locationCount)

  return unknown.length
    ? `no evidence location ${unknown.join(', ')} among the ${locationCount} sent`
    : null
}

// A missing licence is left for addApplicationTask to report, as it is for every
// other task type.
const assertProcessable = async (db, logger, body) => {
  const marineLicence = await db
    .collection(collectionMarineLicences)
    .findOne(
      { applicationReference: body.applicationReference },
      { projection: { applicationTasks: 1, siteNoticeEvidence: 1 } }
    )

  if (!marineLicence) {
    return
  }

  const reason = findUnprocessableReason(marineLicence, body.rejectedLocations)

  if (reason) {
    rejectUnprocessable(logger, body.applicationReference, reason)
  }
}

const buildLocations = (rejectedLocations) =>
  rejectedLocations
    .map(({ locationNumber, reason }) => ({ locationNumber, reason }))
    .sort((a, b) => a.locationNumber - b.locationNumber)

export const handleSiteNoticeEvidenceRejection = async (
  db,
  logger,
  { body: rawBody, id }
) => {
  const { value: body, error } =
    siteNoticeEvidenceRejectionMessageSchema.validate(rawBody)

  if (error) {
    rejectUnprocessable(logger, rawBody.applicationReference, error.message)
  }

  await assertProcessable(db, logger, body)

  const { applicationReference, userName, userEmail } = body

  const result = await addApplicationTask(db, logger, {
    applicationReference,
    type: APPLICATION_TASK_TYPE.RESUBMIT_SITE_NOTICE_EVIDENCE,
    data: { locations: buildLocations(body.rejectedLocations) },
    updatedBy: id
  })

  if (!result) {
    return null
  }

  if (!userEmail) {
    logNoRecipient(
      logger,
      'Raised the resubmit site notice evidence task',
      applicationReference
    )
    return result
  }

  await sendResubmitSiteNoticeEvidenceEmail({
    db,
    userName,
    userEmail,
    applicationReference,
    viewDetailsUrl: `${config.get('frontEndBaseUrl')}/marine-licence/view-details/${result.marineLicence._id}`
  })

  return result
}
