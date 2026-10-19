import { config } from '../../../../config.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { APPLICATION_TASK_TYPE } from '../../../constants/marine-licence.js'
import { resubmitSiteNoticeEvidenceMessageSchema } from '../../../models/resubmit-site-notice-evidence.js'
import { addApplicationTask } from './add-application-task.js'
import { logDiscarded, logNoRecipient } from './mas-logging.js'
import { sendResubmitSiteNoticeEvidenceEmail } from './send-application-task-email.js'

const discard = (logger, applicationReference, reason) => {
  logDiscarded(
    logger,
    'Discarding resubmit site notice evidence request',
    applicationReference,
    reason
  )
  return null
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
const findReasonToDiscard = async (db, body) => {
  const marineLicence = await db
    .collection(collectionMarineLicences)
    .findOne(
      { applicationReference: body.applicationReference },
      { projection: { applicationTasks: 1, siteNoticeEvidence: 1 } }
    )

  return marineLicence
    ? findUnprocessableReason(marineLicence, body.rejectedLocations)
    : null
}

const buildLocations = (rejectedLocations) =>
  rejectedLocations
    .map(({ locationNumber, reason }) => ({ locationNumber, reason }))
    .sort((a, b) => a.locationNumber - b.locationNumber)

export const handleResubmitSiteNoticeEvidenceRequest = async (
  db,
  logger,
  { body: rawBody, id }
) => {
  const { value: body, error } =
    resubmitSiteNoticeEvidenceMessageSchema.validate(rawBody)

  if (error) {
    return discard(logger, rawBody.applicationReference, error.message)
  }

  const { applicationReference, userName, userEmail } = body

  const reason = await findReasonToDiscard(db, body)

  if (reason) {
    return discard(logger, applicationReference, reason)
  }

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
