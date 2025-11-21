import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'

export const getExemptionFromDb = async (request) => {
  const { params, db } = request
  const result = await db
    .collection('exemptions')
    .findOne({ _id: ObjectId.createFromHexString(params.id) })

  if (!result) {
    throw Boom.notFound('Exemption not found')
  }
  return result
}
