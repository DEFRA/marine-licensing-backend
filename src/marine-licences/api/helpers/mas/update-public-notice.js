import { config } from '../../../../config.js'
import { APPLICATION_TASK_TYPE } from '../../../constants/marine-licence.js'
import { addApplicationTask } from './add-application-task.js'
import { logDiscarded, logNoRecipient } from './mas-logging.js'
import { sendPublicNoticeEmail } from './send-public-notice-email.js'

const buildPublicNoticeData = (body) => {
  if (!body.publicNoticeRequirement) {
    return null
  }

  return {
    publicNoticeRequirement: body.publicNoticeRequirement,
    summary: {
      proposedWorksSummary: body.proposedWorksSummary,
      siteNoticeSummary: body.siteNoticeSummary
    },
    requestRelatesTo: body.requestRelatesTo
  }
}

export const updatePublicNotice = async (db, logger, { body, id }) => {
  const { applicationReference, userName, userEmail } = body
  const frontEndBaseUrl = config.get('frontEndBaseUrl')

  const data = buildPublicNoticeData(body)

  if (!data) {
    logDiscarded(
      logger,
      'Discarding public notice',
      applicationReference,
      `no valid requestRelatesTo '${body.requestRelatesTo}'`
    )
    return null
  }

  const result = await addApplicationTask(db, logger, {
    applicationReference,
    type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
    data,
    updatedBy: id
  })

  if (!result) {
    return null
  }

  if (!userEmail) {
    logNoRecipient(
      logger,
      `Raised the public notice task`,
      applicationReference
    )
    return result
  }

  await sendPublicNoticeEmail({
    db,
    userName,
    userEmail,
    applicationReference,
    viewDetailsUrl: `${frontEndBaseUrl}/marine-licence/view-details/${result.marineLicence._id}`
  })

  return result
}
