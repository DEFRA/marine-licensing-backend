import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { submitMarineLicence } from '../../models/submit-marine-licence.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { generateApplicationReference } from '../../../shared/helpers/reference-generator.js'
import { authorizeOwnership } from '../../../shared/helpers/authorize-ownership.js'
import { getContactId } from '../../../shared/helpers/get-contact-id.js'
import { MarineLicenceService } from '../services/marine-licence.service.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

const checkForIncompleteTasks = (marineLicence) => {
  const taskList = createTaskList(marineLicence)
  const incompleteTasks = Object.entries(taskList)
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
        status: MARINE_LICENCE_STATUS.ACTIVE,
        updatedAt,
        updatedBy
      }
    }
  )

  if (updateResult.matchedCount === 0) {
    throw Boom.notFound('Marine licence not found during update')
  }
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
      const { payload, db, locker } = request
      const { id } = payload

      const marineLicence = await getMarineLicenceFromDb(request, id)

      checkForIncompleteTasks(marineLicence)

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
