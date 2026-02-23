import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { submitExemption } from '../../models/submit-exemption.js'
import { ObjectId } from 'mongodb'
import { createTaskList } from '../helpers/createTaskList.js'
import { generateApplicationReference } from '../helpers/reference-generator.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { ExemptionService } from '../services/exemption.service.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { config } from '../../../config.js'
import { sendUserEmailConfirmation } from '../helpers/send-user-email-confirmation.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { addToDynamicsQueue } from '../../../shared/common/helpers/dynamics/index.js'
import { addToEmpQueue } from '../../../shared/common/helpers/emp/emp-processor.js'
import { updateMarinePlanningAreas } from '../../../shared/common/helpers/geo/update-marine-planning-areas.js'
import { updateCoastalOperationsAreas } from '../../../shared/common/helpers/geo/update-coastal-operations-areas.js'
import { DYNAMICS_REQUEST_ACTIONS } from '../../../shared/common/constants/request-queue.js'

const checkForIncompleteTasks = (exemption) => {
  const taskList = createTaskList(exemption)
  const incompleteTasks = Object.entries(taskList)
    .filter(([_task, status]) => status !== 'COMPLETED')
    .map(([task]) => task)

  if (incompleteTasks.length > 0) {
    throw Boom.badRequest(
      'Exemption is incomplete. Missing sections: ' + incompleteTasks.join(', ')
    )
  }
}

const updateMultiSiteEnabled = (exemption) => {
  const { multipleSiteDetails, siteDetails } = exemption

  if (multipleSiteDetails.multipleSitesEnabled && siteDetails.length === 1) {
    return { ...multipleSiteDetails, multipleSitesEnabled: false }
  }

  return multipleSiteDetails
}

const getExemptionFromDb = async (request, exemptionId) => {
  const { auth, db, logger } = request
  const currentUserId = getContactId(auth)
  const exemptionService = new ExemptionService({ db, logger })
  const exemption = await exemptionService.getExemptionById({
    id: exemptionId,
    currentUserId
  })

  if (exemption.applicationReference) {
    throw Boom.conflict('Exemption has already been submitted')
  }
  return exemption
}

const updateExemptionRecord = async ({
  request,
  payload,
  applicationReference,
  exemption,
  submittedAt
}) => {
  const { db } = request
  const { id, updatedAt, updatedBy } = payload
  const updateResult = await db.collection(collectionExemptions).updateOne(
    { _id: ObjectId.createFromHexString(id) },
    {
      $set: {
        applicationReference,
        multipleSiteDetails: updateMultiSiteEnabled(exemption),
        submittedAt,
        status: EXEMPTION_STATUS.ACTIVE,
        updatedAt,
        updatedBy
      }
    }
  )
  if (updateResult.matchedCount === 0) {
    throw Boom.notFound('Exemption not found during update')
  }
}

export const submitExemptionController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    pre: [{ method: authorizeOwnership(collectionExemptions) }],
    validate: {
      payload: submitExemption
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, locker } = request
      const { id, updatedAt, updatedBy, userEmail, userName } = payload
      const { isDynamicsEnabled } = config.get('dynamics')
      const { isEmpEnabled } = config.get('exploreMarinePlanning')
      const frontEndBaseUrl = config.get('frontEndBaseUrl')
      const exemption = await getExemptionFromDb(request, id)
      checkForIncompleteTasks(exemption)
      const applicationReference = await generateApplicationReference(
        db,
        locker,
        'EXEMPTION'
      )
      const submittedAt = new Date()
      await updateExemptionRecord({
        request,
        payload,
        applicationReference,
        exemption,
        submittedAt
      })
      await updateCoastalOperationsAreas(exemption, db, {
        updatedAt,
        updatedBy
      })
      await updateMarinePlanningAreas(exemption, db, { updatedAt, updatedBy })
      if (isDynamicsEnabled) {
        await addToDynamicsQueue({
          request,
          applicationReference,
          action: DYNAMICS_REQUEST_ACTIONS.SUBMIT
        })
      }
      if (isEmpEnabled) {
        await addToEmpQueue({
          db,
          fields: {
            ...payload,
            applicationReference
          },
          server: request.server
        })
      }

      const { organisation } = exemption
      // async; don't wait for this to complete
      sendUserEmailConfirmation({
        db,
        userName,
        userEmail,
        organisation,
        applicationReference,
        frontEndBaseUrl,
        exemptionId: id
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
      throw Boom.internal(`Error submitting exemption: ${error.message}`)
    }
  }
}
