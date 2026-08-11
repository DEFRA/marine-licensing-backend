import Boom from '@hapi/boom'

export const versionedUpdate = async ({
  db,
  collectionName,
  id,
  _id,
  sitePath,
  expectedUpdatedAt,
  updateOps
}) => {
  const result = await db
    .collection(collectionName)
    .updateOne(
      { _id, [sitePath]: { $exists: true }, updatedAt: expectedUpdatedAt },
      updateOps
    )

  if (result.matchedCount === 0) {
    throw Boom.conflict(
      `Marine Licence ${id} was modified by another user. Please reload and try again.`
    )
  }

  return result
}
