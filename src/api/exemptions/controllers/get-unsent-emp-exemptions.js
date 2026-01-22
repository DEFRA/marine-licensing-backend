import { StatusCodes } from 'http-status-codes'
import {
  collectionEmpQueue,
  collectionEmpQueueFailed,
  collectionExemptions
} from '../../../common/constants/db-collections.js'

export const getUnsentEmpExemptionsController = {
  handler: async (request, h) => {
    const { db } = request

    // get exemptions that meet all the following:
    // - status is ACTIVE
    // - exemption in not in the exemption-emp-queue collection - ie it's not currently being sent or waiting for another retry
    // also, if an exemption in the returned list has previously failed to send to EMP after retries, then include the date-time that it was added to the exemption-emp-queue-failed collection.
    const unsentExemptions = await db
      .collection(collectionExemptions)
      .aggregate([
        { $match: { status: 'ACTIVE' } },
        {
          $lookup: {
            from: collectionEmpQueue,
            localField: 'applicationReference',
            foreignField: 'applicationReferenceNumber',
            as: 'queueItems'
          }
        },
        { $match: { queueItems: { $size: 0 } } },
        {
          $lookup: {
            from: collectionEmpQueueFailed,
            let: { appRef: '$applicationReference' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$applicationReferenceNumber', '$$appRef'] }
                }
              },
              { $sort: { updatedAt: -1 } },
              { $limit: 1 }
            ],
            as: 'failedItems'
          }
        },
        {
          $project: {
            _id: 1,
            projectName: 1,
            applicationReference: 1,
            status: 1,
            submittedAt: 1,
            previouslyFailedAt: {
              $ifNull: [{ $arrayElemAt: ['$failedItems.updatedAt', 0] }, null]
            }
          }
        },
        { $sort: { submittedAt: -1 } }
      ])
      .toArray()

    const failedPendingRetries = await db
      .collection(collectionEmpQueue)
      .aggregate([
        { $match: { status: 'failed' } },
        {
          $project: {
            _id: 0,
            applicationReference: '$applicationReferenceNumber',
            retries: 1
          }
        }
      ])
      .toArray()

    return h
      .response({
        message: 'success',
        value: {
          unsentExemptions,
          failedPendingRetries
        }
      })
      .code(StatusCodes.OK)
  }
}
