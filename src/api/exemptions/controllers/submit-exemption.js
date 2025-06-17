import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { submitExemption } from '../../../models/submit-exemption.js'
import { ObjectId } from 'mongodb'
import { createTaskList } from '../helpers/createTaskList.js'
import { generateApplicationReference } from '../helpers/reference-generator.js'

export const submitExemptionController = {
  options: {
    validate: {
      payload: submitExemption
    }
  },
  handler: async (request, h) => {
    try {
      const { payload, db, locker } = request
      const { id } = payload

      const exemption = await db
        .collection('exemptions')
        .findOne({ _id: ObjectId.createFromHexString(id) })

      if (!exemption) {
        throw Boom.notFound('Exemption not found')
      }

      if (exemption.applicationReference) {
        throw Boom.conflict('Exemption has already been submitted')
      }

      const taskList = createTaskList(exemption)

      const incompleteTasks = Object.entries(taskList)
        .filter(([task, status]) => status !== 'COMPLETED')
        .map(([task]) => task)

      if (incompleteTasks.length > 0) {
        throw Boom.badRequest(
          'Exemption is incomplete. Missing sections: ' +
            incompleteTasks.join(', ')
        )
      }

      const applicationReference = await generateApplicationReference(
        db,
        locker,
        'EXEMPTION'
      )

      const updateResult = await db.collection('exemptions').updateOne(
        { _id: ObjectId.createFromHexString(id) },
        {
          $set: {
            applicationReference,
            submittedAt: new Date(),
            status: 'submitted'
          }
        }
      )

      if (updateResult.matchedCount === 0) {
        throw Boom.notFound('Exemption not found during update')
      }

      return h
        .response({
          message: 'success',
          value: {
            applicationReference,
            submittedAt: new Date().toISOString()
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
