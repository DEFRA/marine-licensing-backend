import { StatusCodes } from 'http-status-codes'
import {
  collectionEmpQueue,
  collectionEmpQueueFailed,
  collectionExemptions
} from '../../../common/constants/db-collections.js'

export const getUnsentEmpExemptionsController = {
  handler: async (request, h) => {
    const { db } = request

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
