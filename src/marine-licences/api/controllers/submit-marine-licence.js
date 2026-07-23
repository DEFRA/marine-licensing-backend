import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { submitMarineLicence } from '../../models/submit-marine-licence.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { filterCurrentPolicyResponses } from '../helpers/marine-plan-policies/filter-current-policy-responses.js'
import { generateApplicationReference } from '../../../shared/helpers/reference-generator.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import {
  DYNAMICS_REQUEST_ACTIONS,
  DYNAMICS_QUEUE_TYPES
} from '../../../shared/common/constants/request-queue.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/dynamics-processor.js'
import { config } from '../../../config.js'
import { sendEmailConfirmation } from '../../../shared/helpers/send-email-confirmation.js'
import { getOrganisationDetailsFromAuthToken } from '../../../shared/helpers/get-organisation-from-token.js'
import { updateCoastalOperationsAreas } from '../../../shared/common/helpers/geo/update-coastal-operations-areas.js'
import { updateMarinePlanningAreas } from '../../../shared/common/helpers/geo/update-marine-planning-areas.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'

const checkForIncompleteTasks = (marineLicence, isCitizen) => {
  const { count: marinePlanPolicyResponseCount } = filterCurrentPolicyResponses(
    marineLicence.marinePlanPolicies,
    marineLicence.marinePlanPolicyResponses
  )
  const taskList = createTaskList(marineLicence, isCitizen, {
    marinePlanPolicyResponseCount
  })
  const incompleteTasks = Object.entries(taskList)
    .filter(([task]) => task !== 'waterFrameworkDirective') // Temporary until Water Framework Directive is complete
    .filter(([_task, status]) => status !== 'COMPLETED')
    .map(([task]) => task)

  if (incompleteTasks.length > 0) {
    throw Boom.badRequest(
      'Marine licence is incomplete. Missing sections: ' +
        incompleteTasks.join(', ')
    )
  }
}

const getMarineLicenceFromDb = async (request, marineLicenceId) => {
  const { auth, db, logger } = request
  const currentUserId = getContactId(auth)
  const marineLicenceService = new MarineLicenceService({ db, logger })
  const marineLicence = await marineLicenceService.getMarineLicenceById({
    id: marineLicenceId,
    currentUserId
  })

  if (marineLicence.applicationReference) {
    throw Boom.conflict('Marine licence has already been submitted')
  }

  return marineLicence
}

const updateMarineLicenceRecord = async ({
  request,
  payload,
  applicationReference,
  submittedAt
}) => {
  const { db } = request
  const { id, updatedAt, updatedBy } = payload
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
  updatedAt,
  updatedBy,
  applicationReference,
  request,
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
      request.logger.error(
        structureErrorForECS(err),
        `Failed to update coastal operations areas for ${applicationReference}`
      )
    }),
    updateMarinePlanningAreas(marineLicence, db, {
      updatedAt,
      updatedBy,
      collectionName: collectionMarineLicences
    }).catch((err) => {
      request.logger.error(
        structureErrorForECS(err),
        `Failed to update marine plan areas for ${applicationReference}`
      )
    })
  ])
    .then(async () => {
      if (isDynamicsEnabled) {
        await addToDynamicsQueue({
          request,
          applicationReference,
          action: DYNAMICS_REQUEST_ACTIONS.SUBMIT,
          type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE
        })
      }
    })
    .catch((err) => {
      request.logger.error(
        structureErrorForECS(err),
        `Failed to insert Dynamics queue entry for ${applicationReference}`
      )
    })
}

export const submitMarineLicenceController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionMarineLicences) }],
    validate: {
      payload: submitMarineLicence
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, locker, auth } = request
      const { id, userName, userEmail } = payload

      const { userRelationshipType } = getOrganisationDetailsFromAuthToken(auth)

      const isCitizen = userRelationshipType === 'Citizen'

      const { isDynamicsEnabled } = config.get('dynamics')
      const frontEndBaseUrl = config.get('frontEndBaseUrl')

      const marineLicence = await getMarineLicenceFromDb(request, id)

      checkForIncompleteTasks(marineLicence, isCitizen)

      const applicationReference = await generateApplicationReference(
        db,
        locker,
        'MARINE_LICENCE'
      )

      const submittedAt = new Date()

      await updateMarineLicenceRecord({
        request,
        payload,
        applicationReference,
        submittedAt
      })

      const { updatedAt, updatedBy } = payload

      // Run geo lookups in the background so the user receives
      // applicationReference and submittedAt immediately.
      runPostSubmitBackgroundWork({
        marineLicence,
        db,
        updatedAt,
        updatedBy,
        applicationReference,
        request,
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
      })

      return h
        .response({
          message: 'success',
          value: {
            applicationReference,
            submittedAt: submittedAt.toISOString()
          }
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error submitting marine licence: ${error.message}`)
    }
  }
}
