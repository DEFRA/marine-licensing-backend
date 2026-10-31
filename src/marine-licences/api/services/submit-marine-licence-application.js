import Boom from '@hapi/boom'
import { ObjectId } from 'mongodb'
import { generateApplicationReference } from '../../../shared/helpers/reference-generator.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import {
  DYNAMICS_REQUEST_ACTIONS,
  DYNAMICS_QUEUE_TYPES
} from '../../../shared/common/constants/request-queue.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/dynamics-processor.js'
import { config } from '../../../config.js'
import { sendEmailConfirmation } from '../../../shared/helpers/send-email-confirmation.js'
import { updateCoastalOperationsAreas } from '../../../shared/common/helpers/geo/update-coastal-operations-areas.js'
import { updateMarinePlanningAreas } from '../../../shared/common/helpers/geo/update-marine-planning-areas.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'

const updateMarineLicenceRecord = async ({
  db,
  id,
  applicationReference,
  submittedAt,
  updatedAt,
  updatedBy
}) => {
  const updateResult = await db.collection(collectionMarineLicences).updateOne(
    { _id: ObjectId.createFromHexString(id) },
    {
      $set: {
        applicationReference,
        submittedAt,
        status: MARINE_LICENCE_STATUS.SUBMITTED,
        updatedAt,
        updatedBy
      }
    }
  )

  if (updateResult.matchedCount === 0) {
    throw Boom.notFound('Marine licence not found during update')
  }
}

const runPostSubmitBackgroundWork = ({
  marineLicence,
  db,
  logger,
  updatedAt,
  updatedBy,
  applicationReference,
  isDynamicsEnabled
}) => {
  // Each geo operation catches its own errors so a failure in one does
  // not block the other or the Dynamics queue insert — geo areas can be
  Promise.all([
    updateCoastalOperationsAreas(marineLicence, db, {
      updatedAt,
      updatedBy,
      collectionName: collectionMarineLicences
    }).catch((err) => {
      logger.error(
        structureErrorForECS(err),
        `Failed to update coastal operations areas for ${applicationReference}`
      )
    }),
    updateMarinePlanningAreas(marineLicence, db, {
      updatedAt,
      updatedBy,
      collectionName: collectionMarineLicences
    }).catch((err) => {
      logger.error(
        structureErrorForECS(err),
        `Failed to update marine plan areas for ${applicationReference}`
      )
    })
  ])
    .then(async () => {
      if (isDynamicsEnabled) {
        await addToDynamicsQueue({
          applicationReference,
          action: DYNAMICS_REQUEST_ACTIONS.SUBMIT,
          type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
        })
      }
    })
    .catch((err) => {
      logger.error(
        structureErrorForECS(err),
        `Failed to insert Dynamics queue entry for ${applicationReference}`
      )
    })
}

export const submitMarineLicenceApplication = async ({
  db,
  locker,
  logger,
  id,
  marineLicence,
  userName,
  userEmail,
  updatedAt,
  updatedBy
}) => {
  const { isDynamicsEnabled } = config.get('dynamics')
  const frontEndBaseUrl = config.get('frontEndBaseUrl')

  const applicationReference = await generateApplicationReference(
    db,
    locker,
    'MARINE_LICENCE'
  )

  const submittedAt = new Date()

  await updateMarineLicenceRecord({
    db,
    id,
    applicationReference,
    submittedAt,
    updatedAt,
    updatedBy
  })

  // Run geo lookups in the background so the user receives
  // applicationReference and submittedAt immediately.
  runPostSubmitBackgroundWork({
    marineLicence,
    db,
    logger,
    updatedAt,
    updatedBy,
    applicationReference,
    isDynamicsEnabled
  })

  const { organisation } = marineLicence
  // async; don't wait for this to complete
  sendEmailConfirmation({
    db,
    userName,
    userEmail,
    organisation,
    applicationReference,
    viewDetailsUrl: `${frontEndBaseUrl}/marine-licence/view-details/${id}`,
    projectType: 'marine-licence'
  }).catch((err) => {
    logger.error(
      structureErrorForECS(err),
      `Failed to send confirmation email for ${applicationReference}`
    )
  })

  return { applicationReference, submittedAt }
}
